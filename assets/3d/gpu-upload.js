/* Big pictures onto the GPU without a stall.
   decode(): fetch + createImageBitmap, so the picture is decoded off the main thread.
   stripUploader(): the decoded picture goes into immutable texture storage (full mip chain) in
   horizontal strips, one per step() (call once per frame), and the mip levels are built on the GPU at
   the end. A 4096 x 2048 picture then costs a few short uploads instead of one long freeze.
   The result is a THREE.Texture with version 0: three never uploads it itself, it only binds the GL
   texture we hand it (rows are stored top first, so sample with v flipped). */
import * as THREE from './three.module.min.js';

const BITMAP = { premultiplyAlpha: 'none', colorSpaceConversion: 'none' };
export const canStream = typeof createImageBitmap === 'function' && typeof fetch === 'function';

// compile a scene's programs ahead of their first use: in parallel where the GPU driver can, else at
// once (still ahead of time); resolves when they are ready
export function compileAhead(renderer, scene, camera) {
  if (renderer.compileAsync && renderer.extensions.has('KHR_parallel_shader_compile')) return renderer.compileAsync(scene, camera);
  renderer.compile(scene, camera);
  return Promise.resolve();
}

export function decode(url) {
  return fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); }).then(b => createImageBitmap(b, BITMAP));
}

export function stripUploader(renderer, bitmap, { rows = 128, repeatS = false, aniso = 1 } = {}) {
  const gl = renderer.getContext();
  const w = bitmap.width, h = bitmap.height;
  const glTex = gl.createTexture();
  const texture = new THREE.Texture();
  renderer.properties.get(texture).__webglTexture = glTex;
  const bind = () => renderer.state.bindTexture(gl.TEXTURE_2D, glTex);
  bind();
  gl.texStorage2D(gl.TEXTURE_2D, Math.floor(Math.log2(Math.max(w, h))) + 1, gl.RGBA8, w, h);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeatS ? gl.REPEAT : gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const an = renderer.extensions.get('EXT_texture_filter_anisotropic');
  if (an && aniso > 1) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, aniso);
  // the strips are cut off the main thread too, two ahead of the upload
  const cuts = [];
  let next = 0, done = false, failed = false;
  const cut = () => {
    if (next >= h) return;
    const c = { top: next, n: Math.min(rows, h - next), s: null }; next += c.n;
    cuts.push(c);
    createImageBitmap(bitmap, 0, c.top, w, c.n, BITMAP).then(s => { c.s = s; }, () => { failed = true; });
  };
  cut(); cut();
  return {
    texture,
    get done() { return done; },
    get failed() { return failed; },
    // uploads the next strip if it is cut; true once the texture is complete
    step() {
      if (done || failed) return done;
      const c = cuts[0];
      if (!c || !c.s) return false;
      cuts.shift(); cut();
      bind();
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, c.top, gl.RGBA, gl.UNSIGNED_BYTE, c.s);
      c.s.close();
      if (c.top + c.n >= h) { gl.generateMipmap(gl.TEXTURE_2D); bitmap.close(); done = true; }
      return done;
    },
    dispose() { gl.deleteTexture(glTex); texture.dispose(); }
  };
}
