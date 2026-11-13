/* Light bloom for the globe behind the page: the bright parts spill a soft glow. The scene renders into a
   float target (values above 1 survive) at its own resolution (sceneScale of the canvas, times the
   quality the frame-time governor sets), a bright pass feeds a chain of blurred levels at falling
   resolution, and the composite adds them back at full canvas resolution with a soft highlight shoulder
   instead of a hard clip; the levels are summed at low resolution on the way back up, so the full-size
   composite reads two textures. Phones get fewer, smaller levels. warm() compiles the programs and allocates
   every target ahead of the first use, so the hand-over from the intro never stalls on it. */
import * as THREE from './three.module.min.js';
import { compileAhead } from './gpu-upload.js';

export function createBloom(renderer, { levels = 4, scale = 0.5, msaa = 0, strength = 0.85, threshold = 0.5, sceneScale = 1 } = {}) {
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const quad = new THREE.Mesh(tri); quad.frustumCulled = false;
  const pass = new THREE.Scene(); pass.add(quad);
  const cam = new THREE.Camera();
  const type = THREE.HalfFloatType;
  const opt = { type, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  const rtScene = new THREE.WebGLRenderTarget(1, 1, { type, samples: msaa, depthBuffer: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const A = [], B = [];
  for (let i = 0; i < levels; i++) { A.push(new THREE.WebGLRenderTarget(1, 1, opt)); B.push(new THREE.WebGLRenderTarget(1, 1, opt)); }
  const VS = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }';
  const base = { vertexShader: VS, depthTest: false, depthWrite: false };
  const bright = new THREE.ShaderMaterial({
    ...base, uniforms: { t: { value: null }, th: { value: threshold } },
    fragmentShader: `uniform sampler2D t; uniform float th; varying vec2 vUv;
      void main(){ vec3 c=texture2D(t,vUv).rgb; float l=max(c.r,max(c.g,c.b)); gl_FragColor=vec4(c*smoothstep(th,th+.4,l),1.); }`
  });
  const blur = new THREE.ShaderMaterial({
    ...base, uniforms: { t: { value: null }, dir: { value: new THREE.Vector2() } },
    fragmentShader: `uniform sampler2D t; uniform vec2 dir; varying vec2 vUv;
      void main(){ vec3 c=texture2D(t,vUv).rgb*.2270270270;
        c+=(texture2D(t,vUv+dir*1.3846153846).rgb+texture2D(t,vUv-dir*1.3846153846).rgb)*.3162162162;
        c+=(texture2D(t,vUv+dir*3.2307692308).rgb+texture2D(t,vUv-dir*3.2307692308).rgb)*.0702702703;
        gl_FragColor=vec4(c,1.); }`
  });
  // the levels are summed on the way back up, at low resolution (C_i = w_i * A_i + upsampled C_i+1),
  // so the full-resolution composite reads two textures instead of one per level
  const W = levels > 3 ? [0.3, 0.3, 0.25, 0.15] : [0.3, 0.3, 0.4];
  const up = new THREE.ShaderMaterial({
    ...base, uniforms: { tA: { value: null }, tC: { value: null }, w: { value: 1 }, wc: { value: 1 } },
    fragmentShader: `uniform sampler2D tA, tC; uniform float w, wc; varying vec2 vUv;
      void main(){ gl_FragColor=vec4(texture2D(tA,vUv).rgb*w+texture2D(tC,vUv).rgb*wc,1.); }`
  });
  const comp = new THREE.ShaderMaterial({
    ...base, uniforms: { tScene: { value: rtScene.texture }, tGlow: { value: null }, strength: { value: strength }, fade: { value: 1 } },
    fragmentShader: `uniform sampler2D tScene, tGlow; uniform float strength, fade; varying vec2 vUv;
      void main(){
        vec3 c=texture2D(tScene,vUv).rgb;
        c+=texture2D(tGlow,vUv).rgb*strength;
        vec3 x=max(c-.8,0.); c=c-x+.22*(1.-exp(-x/.22));
        vec2 q=vUv-.5; c*=1.-.28*dot(q,q);
        gl_FragColor=vec4(mix(vec3(.008,.016,.043),c,fade),1.);
      }`
  });

  const size = new THREE.Vector2();
  let quality = 1, sw = 1, sh = 1;
  function setSize() {
    renderer.getDrawingBufferSize(size);
    const k = sceneScale * quality;
    sw = Math.max(1, Math.round(size.x * k)); sh = Math.max(1, Math.round(size.y * k));
    rtScene.setSize(sw, sh);
    let w = Math.max(1, Math.round(sw * scale)), h = Math.max(1, Math.round(sh * scale));
    for (let i = 0; i < levels; i++) { A[i].setSize(w, h); B[i].setSize(w, h); w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); }
  }
  function alloc() { [rtScene, ...A, ...B].forEach(r => renderer.initRenderTarget(r)); }
  function draw(mat, target) { quad.material = mat; renderer.setRenderTarget(target); renderer.render(pass, cam); }

  return {
    setSize,
    strength: comp.uniforms.strength, fade: comp.uniforms.fade,
    // pixels per CSS pixel the 3D scene is drawn with (for point sizes)
    get pixelRatio() { return renderer.getPixelRatio() * sceneScale * quality; },
    get quality() { return quality; },
    materials: [bright, blur, up, comp],
    setQuality(q) { if (q === quality) return; quality = q; setSize(); alloc(); },
    // compile the pass programs in parallel and allocate every target now, not on the first frame
    warm() {
      alloc();
      const s = new THREE.Scene();
      [bright, blur, up, comp].forEach(m => { const o = new THREE.Mesh(tri, m); o.frustumCulled = false; s.add(o); });
      return compileAhead(renderer, s, cam);
    },
    render(scene, camera) {
      renderer.setRenderTarget(rtScene); renderer.clear(); renderer.render(scene, camera);
      bright.uniforms.t.value = rtScene.texture; draw(bright, A[0]);
      for (let i = 0; i < levels; i++) {
        const src = i === 0 ? A[0] : A[i - 1];
        blur.uniforms.t.value = src.texture; blur.uniforms.dir.value.set(1 / B[i].width, 0); draw(blur, B[i]);
        blur.uniforms.t.value = B[i].texture; blur.uniforms.dir.value.set(0, 1 / A[i].height); draw(blur, A[i]);
      }
      // back up: B[i] = W[i] * A[i] + B[i+1] (the coarsest level starts the sum on its own)
      let c = A[levels - 1];
      for (let i = levels - 2; i >= 0; i--) {
        up.uniforms.tA.value = A[i].texture; up.uniforms.tC.value = c.texture;
        up.uniforms.w.value = W[i]; up.uniforms.wc.value = i === levels - 2 ? W[levels - 1] : 1;
        draw(up, B[i]); c = B[i];
      }
      comp.uniforms.tGlow.value = c.texture;
      draw(comp, null);
    },
    dispose() { rtScene.dispose(); A.concat(B).forEach(r => r.dispose()); [bright, blur, up, comp].forEach(m => m.dispose()); tri.dispose(); }
  };
}
