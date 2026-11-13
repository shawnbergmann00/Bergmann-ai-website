/* Light bloom for the scroll film: the bright parts of each frame spill a soft glow, as in the storyboard
   pictures. The scene renders into a float target (values above 1 survive), a bright pass feeds a
   chain of blurred levels at falling resolution, and the composite adds them back with a soft
   highlight shoulder instead of a hard clip. Phones get fewer, smaller levels. */
import * as THREE from './three.module.min.js';

export function createBloom(renderer, { levels = 4, scale = 0.5, msaa = 4, strength = 0.85, threshold = 0.5 } = {}) {
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const quad = new THREE.Mesh(tri); quad.frustumCulled = false;
  const pass = new THREE.Scene(); pass.add(quad);
  const cam = new THREE.Camera();
  const type = THREE.HalfFloatType;
  const opt = { type, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  const rtScene = new THREE.WebGLRenderTarget(1, 1, { type, samples: msaa, depthBuffer: true });
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
  const uLv = {}; for (let i = 0; i < 4; i++) uLv['b' + i] = { value: null };
  const comp = new THREE.ShaderMaterial({
    ...base, uniforms: { tScene: { value: rtScene.texture }, strength: { value: strength }, ...uLv },
    fragmentShader: `uniform sampler2D tScene, b0, b1, b2, b3; uniform float strength; varying vec2 vUv;
      void main(){
        vec3 c=texture2D(tScene,vUv).rgb;
        vec3 g=texture2D(b0,vUv).rgb*.3+texture2D(b1,vUv).rgb*.3+texture2D(b2,vUv).rgb*${levels > 3 ? '.25+texture2D(b3,vUv).rgb*.15' : '.4'};
        c+=g*strength;
        vec3 x=max(c-.8,0.); c=c-x+.22*(1.-exp(-x/.22));
        vec2 q=vUv-.5; c*=1.-.28*dot(q,q);
        gl_FragColor=vec4(c,1.);
      }`
  });
  for (let i = 0; i < 4; i++) comp.uniforms['b' + i].value = A[Math.min(i, levels - 1)].texture;

  const size = new THREE.Vector2();
  function setSize() {
    renderer.getDrawingBufferSize(size);
    rtScene.setSize(size.x, size.y);
    let w = Math.max(1, Math.round(size.x * scale)), h = Math.max(1, Math.round(size.y * scale));
    for (let i = 0; i < levels; i++) { A[i].setSize(w, h); B[i].setSize(w, h); w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); }
  }
  function draw(mat, target) { quad.material = mat; renderer.setRenderTarget(target); renderer.render(pass, cam); }

  return {
    setSize,
    strength: comp.uniforms.strength,
    render(scene, camera) {
      renderer.setRenderTarget(rtScene); renderer.clear(); renderer.render(scene, camera);
      bright.uniforms.t.value = rtScene.texture; draw(bright, A[0]);
      for (let i = 0; i < levels; i++) {
        const src = i === 0 ? A[0] : A[i - 1];
        blur.uniforms.t.value = src.texture; blur.uniforms.dir.value.set(1 / B[i].width, 0); draw(blur, B[i]);
        blur.uniforms.t.value = B[i].texture; blur.uniforms.dir.value.set(0, 1 / A[i].height); draw(blur, A[i]);
      }
      draw(comp, null);
    },
    dispose() { rtScene.dispose(); A.concat(B).forEach(r => r.dispose()); [bright, blur, comp].forEach(m => m.dispose()); tri.dispose(); }
  };
}
