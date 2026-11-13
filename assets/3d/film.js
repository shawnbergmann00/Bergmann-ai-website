/* The intro: "Bergmann AI" stands large on the dark page, the turning earth seen through its glass
   letters. Scrolling flies into the letters, as in the client's reference video: the word grows past the
   screen, the dark around it fades, and the earth stands alone, pulled back to the hero picture, where
   the page with "KI-Chatbots und Automatisierungen für Betriebe" arrives over it.
   The picture inside the letters is live: scene.js renders the globe (with its bloom) into a texture,
   and this plate lays the word over it. The letters are glass: the picture inside is lifted, a light rim
   runs along the inner edge, a slow light sweep crosses them, and the globe's light spills just outside.
   The word is a signed distance field, so the outline stays sharp at any zoom (set in Playfair Display
   Italic, SIL OFL): film/word-one.webp in one line for screens wider than tall, film/word-two.webp with
   "Bergmann" over "AI" for phones. R = fine distance (+-8 texels), G = coarse distance (+-64 texels),
   0.5 on the outline, larger inside. The flight goes into a stem of "AI". */
import * as THREE from './three.module.min.js';
import { decode, canStream, compileAhead } from './gpu-upload.js';

function clamp(x, a = 0, b = 1) { return Math.min(b, Math.max(a, x)); }
function sstep(a, b, x) { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); }

// size, ink box [x0, y0, x1, y1] and zoom focus (uv, y down); width = share of the screen width at rest
const WORDS = {
  one: { file: 'word-one', w: 4096, h: 769, box: [0.01782, 0.09363, 0.98218, 0.90507], focus: [0.88342, 0.48179], width: 0.84 },
  two: { file: 'word-two', w: 3072, h: 1318, box: [0.02376, 0.05463, 0.96582, 0.94461], focus: [0.58936, 0.61874], width: 0.86 }
};
const FINE = 8, COARSE = 64;
// timeline (film S 0..10): the word stands, the flight into the letters (the camera pulls back with it),
// then the earth holds briefly before the page comes up
export const FLIGHT = [0.5, 8.6];
const ZMAX = 45;

export function createFilm(renderer) {
  const U = {
    tImg: { value: null }, tGlow: { value: null }, tWord: { value: null }, uRes: { value: new THREE.Vector2(1, 1) },
    uAsp: { value: 1.6 }, uP: { value: new THREE.Vector2() }, uK: { value: 1 }, uFocus: { value: new THREE.Vector2() },
    uTexSz: { value: new THREE.Vector2(1, 1) }, uBg: { value: 1 }, uLt: { value: 1 }, uAlpha: { value: 1 }, uTop: { value: 0 }, uT: { value: 0 }
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthTest: false, depthWrite: false,
    vertexShader: `uniform float uTop; varying vec2 vUv;
      void main(){ vUv=uv; float y=mix(-1.,1.-2.*uTop,uv.y); gl_Position=vec4(position.x,y,0.,1.); }`,
    fragmentShader: `uniform sampler2D tImg, tGlow, tWord; uniform vec2 uRes, uP, uFocus, uTexSz; uniform float uAsp, uK, uBg, uLt, uAlpha, uT; varying vec2 vUv;
      void main(){
        vec2 pu=gl_FragCoord.xy/uRes;                 // the live picture lies 1:1 under the canvas
        vec3 img=texture2D(tImg,pu).rgb;
        vec3 col=img;
        if(uBg>.001||uLt>.001){
          // the word: film units (y -1..1, x -asp..asp) -> word texels around the focus -> word uv
          vec2 p=vec2((vUv.x*2.-1.)*uAsp, vUv.y*2.-1.);
          vec2 tx=(p-uP)/uK;
          vec2 wuv=uFocus+vec2(tx.x,-tx.y)/uTexSz;
          vec2 sd=texture2D(tWord,wuv).rg;
          float d=(sd.r-.5)*${(2 * FINE).toFixed(1)}, dc=(sd.g-.5)*${(2 * COARSE).toFixed(1)};   // texels, + inside
          float aa=max(fwidth(d),1e-4);
          float m=clamp(d/aa+.5,0.,1.);
          // inside: the picture lifted, a glass tint, a light rim along the inner edge, a slow light sweep
          float rimW=max(aa*1.5,2.5);
          float rim=exp(-max(dc,0.)/rimW)*.55+exp(-max(dc,0.)/(rimW*5.))*.18;
          float sw=fract(uT/9.)*1.8-.4;
          float sweep=exp(-pow((wuv.x+(wuv.y-.5)*.35-sw)*7.,2.));
          vec3 ice=vec3(.55,.8,1.);
          vec3 inner=img*mix(1.,2.3,uLt)+uLt*(vec3(.03,.06,.12)+ice*rim*.5+ice*sweep*.16);
          // outside: the dark page with the globe's light spilling a little beyond the outline
          float halo=exp(-max(-dc,0.)/9.)*(1.-m);
          vec3 glow=texture2D(tGlow,pu).rgb;
          vec3 outer=mix(img,vec3(.008,.016,.043)+(glow*1.8+ice*.05)*halo*.6*uLt,uBg);
          col=mix(outer,inner,m);
        }
        gl_FragColor=vec4(col,uAlpha);
      }`
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(quad);
  const cam = new THREE.Camera();

  /* ---------- the word: decoded off the main thread (ImageBitmap); without that, an <img> decoded ahead ---------- */
  const load = (file, cb) => {
    const url = new URL(`./film/${file}.webp`, import.meta.url).href;
    const viaImg = () => { const im = new Image(); im.decoding = 'async'; im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => cb(im)); im.src = url; };
    if (canStream) decode(url).then(cb, viaImg); else viaImg();
  };
  let word = null, wordTex = null, wordImg = null, name = '', aspect = 1.6;
  function use(n) {
    if (n === name) return;
    name = n; word = WORDS[n]; wordImg = null;
    if (wordTex) { wordTex.dispose(); wordTex = null; }
    const want = n;
    load(word.file, b => { if (want === name) wordImg = b; });
  }
  function texture() {
    if (!wordImg) return false;
    if (!wordTex) {
      wordTex = new THREE.Texture(wordImg);
      wordTex.colorSpace = THREE.NoColorSpace; wordTex.flipY = false; wordTex.generateMipmaps = true;
      wordTex.minFilter = THREE.LinearMipmapLinearFilter; wordTex.magFilter = THREE.LinearFilter;
      wordTex.needsUpdate = true; renderer.initTexture(wordTex); U.tWord.value = wordTex;
      U.uTexSz.value.set(word.w, word.h); U.uFocus.value.set(...word.focus);
    }
    return true;
  }

  return {
    use, get name() { return name; }, get ready() { return !!wordImg; },
    // compile the plate program in parallel before the word arrives
    warm() {
      return compileAhead(renderer, scene, cam)
        .then(() => { const p = renderer.properties.get(mat).currentProgram; if (p) { p.getUniforms(); p.getAttributes(); } }).catch(() => {});
    },
    setAspect(a, top) { aspect = a; U.uTop.value = top; U.uAsp.value = a; },
    // true while the word still shows (the globe then goes to a texture first, for this plate)
    showing(S, alpha) { const e = this.progress(S); return alpha < 1 || e < 0.9; },
    // the word over the live picture for timeline value S
    render(S, alpha, t, picture, glow, resW, resH) {
      if (!word || !texture()) return false;
      const e = this.progress(S);
      // the word: its share of the width at rest, its ink centred a touch above the middle
      const inkW = (word.box[2] - word.box[0]) * word.w, inkH = (word.box[3] - word.box[1]) * word.h;
      const k0 = Math.min(2 * aspect * word.width / inkW, 1.1 / inkH);   // film units per texel
      const fx = ((word.focus[0] - (word.box[0] + word.box[2]) / 2) * word.w) * k0;
      const fy = -((word.focus[1] - (word.box[1] + word.box[3]) / 2) * word.h) * k0 + 0.03;
      const c = sstep(0, 0.7, e);                            // the focus drifts to the centre as the flight begins
      U.uP.value.set(fx * (1 - c), fy * (1 - c));
      U.uK.value = k0 * Math.exp(Math.log(ZMAX) * e);
      U.uBg.value = 1 - sstep(0.42, 0.86, e); U.uLt.value = 1 - sstep(0.32, 0.9, e);
      U.tImg.value = picture; U.tGlow.value = glow; U.uRes.value.set(resW, resH);
      U.uAlpha.value = alpha; U.uT.value = t;
      renderer.render(scene, cam);
      return true;
    },
    // how far the flight is: 0 the word stands, 1 the earth stands alone (never quite still, so the
    // first scroll answers at once); the camera follows it
    progress(S) { const u = clamp((S - FLIGHT[0]) / (FLIGHT[1] - FLIGHT[0])); return 0.25 * u + 0.75 * sstep(0, 1, u); },
    dispose() { if (wordTex) wordTex.dispose(); quad.geometry.dispose(); mat.dispose(); }
  };
}
