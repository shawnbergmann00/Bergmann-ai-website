/* The intro: the word "Bergmann" stands large on the dark page, the end picture (AI and the earth)
   seen through its letters. Scrolling flies into the letters, as in the client's reference video: the
   word grows past the screen, the dark around it fades, and the picture stands alone, the original end
   frame. The letters are glass: the picture inside is lifted, a light rim runs along the inner edge, a
   slow light sweeps across them, and light from the picture spills just outside.
   The word is a signed distance field (film/word-sdf.webp, set in Playfair Display Italic, SIL OFL,
   3072 px wide), so the outline stays sharp at any zoom: R = fine distance (+-8 texels), G = coarse
   distance (+-64 texels), 0.5 on the outline, larger inside.
   Two pictures: "wide" for screens wider than tall, "tall" (the portrait panel) for phones. Where a
   screen is wider or taller than the picture, its edge continues as a mirrored, blurred, darkening fade. */
import * as THREE from './three.module.min.js';

function clamp(x, a = 0, b = 1) { return Math.min(b, Math.max(a, x)); }
function sstep(a, b, x) { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); }
function mix(a, b, t) { return a + (b - a) * t; }

// the word texture: size, ink box [x0, y0, x1, y1] and the zoom focus (the thickest stroke near the middle, in the m), uv y down
const WORD = { w: 3072, h: 737, box: [0.02344, 0.09769, 0.96582, 0.90095], focus: [0.52816, 0.53528], fine: 8, coarse: 64 };
// the end picture per screen shape; safe = the part that must stay in view [x0, y0, x1, y1] (picture uv, y down)
const PICS = {
  wide: { file: 'wide-6', safe: [0.1, 0.12, 0.9, 0.85] },
  tall: { file: 'tall-10', safe: [0.1, 0.1, 0.96, 0.86] }
};
// timeline (film S 0..10): the word stands, the flight into the letters, the picture holds
export const FLIGHT = [0.5, 6.8];
const ZMAX = 45;

export function createFilm(renderer) {
  const U = {
    tImg: { value: null }, tWord: { value: null }, fImg: { value: new THREE.Vector4(1, 1, 0.5, 0.5) },
    uAsp: { value: 1.6 }, uP: { value: new THREE.Vector2() }, uK: { value: 1 }, uFocus: { value: new THREE.Vector2(...WORD.focus) },
    uTexSz: { value: new THREE.Vector2(WORD.w, WORD.h) }, uBg: { value: 1 }, uLt: { value: 1 }, uAlpha: { value: 1 }, uTop: { value: 0 }, uT: { value: 0 }
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthTest: false, depthWrite: false,
    vertexShader: `uniform float uTop; varying vec2 vUv;
      void main(){ vUv=uv; float y=mix(-1.,1.-2.*uTop,uv.y); gl_Position=vec4(position.x,y,0.,1.); }`,
    fragmentShader: `uniform sampler2D tImg, tWord; uniform vec4 fImg; uniform vec2 uP, uFocus, uTexSz; uniform float uAsp, uK, uBg, uLt, uAlpha, uT; varying vec2 vUv;
      // screen uv -> picture uv; window f = (width, height, centre x, centre y; picture y down)
      vec2 toPic(vec2 s, vec4 f){ return vec2(f.z+(s.x-.5)*f.x, 1.-(f.w+(.5-s.y)*f.y)); }
      vec3 pic(vec2 uv){
        vec2 m=1.-abs(mod(uv,2.)-1.);
        float e=max(max(-uv.x,uv.x-1.),max(-uv.y,uv.y-1.));
        vec3 sharp=texture(tImg,clamp(uv,0.,1.)).rgb;
        float o=clamp(e,0.,2.);
        vec3 soft=texture(tImg,m,3.+o*16.).rgb*exp(-o*5.5);
        return mix(sharp,soft,smoothstep(-.025,.012,e));
      }
      void main(){
        vec2 pu=toPic(vUv,fImg);
        vec3 img=pic(pu);
        vec3 col=img;
        if(uBg>.001||uLt>.001){
          // the word: film units (y -1..1, x -asp..asp) -> word texels around the focus -> word uv
          vec2 p=vec2((vUv.x*2.-1.)*uAsp, vUv.y*2.-1.);
          vec2 tx=(p-uP)/uK;
          vec2 wuv=uFocus+vec2(tx.x,-tx.y)/uTexSz;
          vec2 sd=texture(tWord,wuv).rg;
          float d=(sd.r-.5)*${(2 * WORD.fine).toFixed(1)}, dc=(sd.g-.5)*${(2 * WORD.coarse).toFixed(1)};   // texels, + inside
          float aa=max(fwidth(d),1e-4);
          float m=clamp(d/aa+.5,0.,1.);
          // inside: the picture lifted, a glass tint, a light rim along the inner edge, a slow light sweep
          float rimW=max(aa*1.5,2.5);
          float rim=exp(-max(dc,0.)/rimW)*.55+exp(-max(dc,0.)/(rimW*5.))*.18;
          float sw=fract(uT/9.)*1.8-.4;
          float sweep=exp(-pow((wuv.x+(wuv.y-.5)*.35-sw)*7.,2.));
          vec3 ice=vec3(.55,.8,1.);
          vec3 inner=img*mix(1.,2.3,uLt)+uLt*(vec3(.03,.06,.12)+ice*rim*.5+ice*sweep*.16);
          // outside: the dark page with the letters' light spilling a little beyond the outline
          float halo=exp(-max(-dc,0.)/9.)*(1.-m);
          vec3 glow=texture(tImg,clamp(pu,0.,1.),4.5).rgb;   // the picture's light, softened, for the spill
          vec3 outer=mix(img,vec3(.008,.016,.043)+(glow*2.2+ice*.05)*halo*.6*uLt,uBg);
          col=mix(outer,inner,m);
        }
        float l=clamp(dot(col,vec3(.3,.55,.15))*1.6,0.,1.);
        gl_FragColor=vec4(col,clamp(uAlpha*1.7-.7*(1.-l),0.,1.));
      }`
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(quad);
  const cam = new THREE.Camera();

  /* ---------- textures ---------- */
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const img = new Image(), word = new Image();
  let pic = null, name = '', imgOk = false, wordOk = false, tImg = null, tWord = null, aspect = 1.6;
  word.decoding = 'async';
  word.onload = () => { wordOk = true; };
  word.src = new URL('./film/word-sdf.webp', import.meta.url).href;
  function use(n) {
    if (n === name) return;
    name = n; pic = PICS[n]; imgOk = false;
    if (tImg) { tImg.dispose(); tImg = null; }
    img.decoding = 'async';
    img.onload = () => { if (img.src.includes(pic.file)) imgOk = true; };
    img.src = new URL(`./film/${pic.file}.webp`, import.meta.url).href;
  }
  function textures() {
    if (!imgOk || !wordOk) return false;
    if (!tImg) {
      tImg = new THREE.Texture(img);
      tImg.colorSpace = THREE.NoColorSpace; tImg.generateMipmaps = true; tImg.minFilter = THREE.LinearMipmapLinearFilter; tImg.magFilter = THREE.LinearFilter;
      tImg.anisotropy = maxAniso; tImg.needsUpdate = true; renderer.initTexture(tImg); U.tImg.value = tImg;
    }
    if (!tWord) {
      tWord = new THREE.Texture(word);
      tWord.colorSpace = THREE.NoColorSpace; tWord.flipY = false; tWord.generateMipmaps = true; tWord.minFilter = THREE.LinearMipmapLinearFilter; tWord.magFilter = THREE.LinearFilter;
      tWord.needsUpdate = true; renderer.initTexture(tWord); U.tWord.value = tWord;
    }
    return true;
  }
  // the window onto the picture for this screen: covers the screen if it can, always holds the safe box; z > 1 pushes in
  function framing(z, out) {
    const ai = img.naturalWidth / img.naturalHeight;
    let ex, ey;
    if (aspect > ai) { ex = 1; ey = ai / aspect; } else { ey = 1; ex = aspect / ai; }
    const [x0, y0, x1, y1] = pic.safe;
    const k = Math.max(1, (x1 - x0) * 1.04 / ex, (y1 - y0) * 1.04 / ey);
    ex = ex * k / z; ey = ey * k / z;
    let cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    cx = ex >= 1 ? mix(0.5, cx, clamp(2 - ex)) : clamp(cx, ex / 2, 1 - ex / 2);
    cy = ey >= 1 ? mix(0.5, cy, clamp(2 - ey)) : clamp(cy, ey / 2, 1 - ey / 2);
    out.set(ex, ey, cx, cy);
  }

  return {
    use, get name() { return name; }, get ready() { return imgOk && wordOk; },
    setAspect(a, top) { aspect = a; U.uTop.value = top; U.uAsp.value = a; },
    // draws the intro for timeline value S at time t; alpha fades it (arrival and hand-over to the page)
    render(S, alpha, t) {
      if (!pic || !textures()) return false;
      const u = clamp((S - FLIGHT[0]) / (FLIGHT[1] - FLIGHT[0]));
      const e = 0.25 * u + 0.75 * sstep(0, 1, u);            // never quite still, so the first scroll answers at once
      // the word: 84 % of the width at rest (88 % on phones), its ink centred a touch above the middle
      const inkW = (WORD.box[2] - WORD.box[0]) * WORD.w, inkH = (WORD.box[3] - WORD.box[1]) * WORD.h;
      const k0 = Math.min(2 * aspect * (aspect < 0.95 ? 0.88 : 0.84) / inkW, 1.1 / inkH);   // film units per texel
      const fx = ((WORD.focus[0] - (WORD.box[0] + WORD.box[2]) / 2) * WORD.w) * k0;
      const fy = -((WORD.focus[1] - (WORD.box[1] + WORD.box[3]) / 2) * WORD.h) * k0 + 0.03;
      const c = sstep(0, 0.7, e);                            // the focus drifts to the centre as the flight begins
      U.uP.value.set(fx * (1 - c), fy * (1 - c));
      U.uK.value = k0 * Math.exp(Math.log(ZMAX) * e);
      U.uBg.value = 1 - sstep(0.42, 0.86, e);
      U.uLt.value = 1 - sstep(0.32, 0.9, e);
      framing(mix(1.1, 1, sstep(0, 1, u)), U.fImg.value);
      U.uAlpha.value = alpha; U.uT.value = t;
      renderer.render(scene, cam);
      return true;
    },
    dispose() { if (tImg) tImg.dispose(); if (tWord) tWord.dispose(); quad.geometry.dispose(); mat.dispose(); }
  };
}
