/* The scroll film: the client's storyboard pictures (upscaled to 4K) as the photographic plate, played
   by the scroll position with real camera moves, plus a layer of real 3D particles in front of it.
   Between two pictures the camera pushes in, pans or flies through, and the next picture arrives
   led by its light (bright parts first). The particles follow the story: an energy ring round the
   brain, a stream out of it, a spiral into the sphere, a warp into the horizon, the light that forms AI.
   Two picture sets: "wide" (six 2.7:1 frames) for screens wider than tall, "tall" (the ten panels)
   for phones. Where a screen is wider or taller than a picture, its edge continues as a mirrored,
   blurred, darkening fade, so no border shows. */
import * as THREE from './three.module.min.js';

function clamp(x, a = 0, b = 1) { return Math.min(b, Math.max(a, x)); }
function sstep(a, b, x) { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); }
function mix(a, b, t) { return a + (b - a) * t; }
function band(x, a, b, c, d) { return sstep(a, b, x) * (1 - sstep(c, d, x)); }
function track(pts) {
  return u => {
    if (u <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (u <= pts[i][0]) return mix(pts[i - 1][1], pts[i][1], sstep(pts[i - 1][0], pts[i][0], u));
    return pts[pts.length - 1][1];
  };
}

/* a shot: picture f, visible from S=a to S=b; safe = the part that must stay in view [x0, y0, x1, y1]
   (picture coordinates, y down); c = the subject [x, y, radius in picture heights] the particles use;
   zoom / panX / panY / exp are tracks over u = 0..1 of the shot; tr = how this shot arrives:
   luma (light-led dissolve), blur (fly-through blur), glow */
const SETS = {
  wide: {
    files: ['wide-1', 'wide-2', 'wide-3', 'wide-4', 'wide-5', 'wide-6'],
    shots: [
      // 1-2 the brain appears and lights up
      { f: 0, a: -1, b: 2.6, safe: [0.26, 0.04, 0.76, 1], c: [0.51, 0.45, 0.42], zoom: [[0, 1], [0.95, 1.08], [1, 1.09]], exp: [[0, 1], [0.45, 1], [0.75, 1.2], [0.9, 1.28], [1, 1.22]] },
      // 3 it breaks into data
      { f: 1, a: 2.15, b: 3.65, safe: [0.2, 0.06, 0.86, 1], c: [0.42, 0.45, 0.4], zoom: [[0, 1.06], [1, 1.0]], panX: [[0, -0.02], [1, 0.04]], tr: { luma: 0.75, glow: 0.3 } },
      // 4 the data gathers into a sphere
      { f: 2, a: 3.2, b: 4.95, safe: [0.25, 0.05, 0.75, 0.98], c: [0.56, 0.5, 0.45], zoom: [[0, 1.0], [1, 1.06]], panX: [[0, -0.05], [0.35, 0], [1, 0.01]], tr: { luma: 0.6, glow: 0.25 } },
      // 5-6 the earth appears and turns, then the camera flies at it
      { f: 3, a: 4.45, b: 7.0, safe: [0.3, 0.04, 0.72, 0.97], c: [0.5, 0.5, 0.45], zoom: [[0, 0.98], [0.78, 1.1], [1, 2.4]], panY: [[0, 0], [0.78, 0], [1, -0.24]], tr: { luma: 0.65, glow: 0.25 } },
      // 7-8 the horizon, the camera eases back, then flies into the sun
      { f: 4, a: 6.4, b: 8.85, safe: [0.15, 0.2, 0.85, 0.8], c: [0.5, 0.35, 0.3], zoom: [[0, 0.82], [0.28, 1.06], [0.755, 1.0], [1, 1.5]], panY: [[0, 0], [0.755, 0], [1, -0.15]], tr: { luma: 0.4, blur: 0.14, glow: 0.12 } },
      // 9-10 out of the sun the camera pulls back, AI forms: the end frame (the original picture)
      { f: 5, a: 8.25, b: 10.7, safe: [0.1, 0.12, 0.9, 0.85], c: [0.66, 0.45, 0.3], zoom: [[0, 1.6], [0.24, 1.42], [0.72, 1.0], [1, 1.0]], panX: [[0, -0.24], [0.24, -0.19], [0.72, 0], [1, 0]], panY: [[0, -0.065], [0.72, 0], [1, 0]], tr: { luma: 0.55, glow: 0.3 } }
    ]
  },
  tall: {
    files: ['tall-01', 'tall-02', 'tall-03', 'tall-04', 'tall-05', 'tall-06', 'tall-07', 'tall-08', 'tall-09', 'tall-10'],
    shots: [
      { f: 0, a: -1, b: 1.0, safe: [0.14, 0.04, 0.86, 1], c: [0.5, 0.35, 0.3], zoom: [[0, 1], [1, 1.05]] },
      { f: 1, a: 0.62, b: 2.0, safe: [0.14, 0.04, 0.86, 1], c: [0.5, 0.35, 0.3], zoom: [[0, 1.03], [1, 1.07]], exp: [[0, 1], [0.6, 1.15], [1, 1.1]], tr: { luma: 0.8, glow: 0.3 } },
      { f: 2, a: 1.62, b: 3.0, safe: [0.1, 0.04, 0.9, 1], c: [0.42, 0.35, 0.3], zoom: [[0, 1.02], [1, 1.06]], panX: [[0, -0.02], [1, 0.03]], tr: { luma: 0.75, glow: 0.35 } },
      { f: 3, a: 2.62, b: 4.0, safe: [0.12, 0.04, 0.88, 1], c: [0.5, 0.42, 0.33], zoom: [[0, 1.0], [1, 1.05]], tr: { luma: 0.6, glow: 0.3 } },
      { f: 4, a: 3.62, b: 5.0, safe: [0.12, 0.1, 0.9, 0.86], c: [0.55, 0.42, 0.33], zoom: [[0, 1.0], [1, 1.05]], tr: { luma: 0.6, glow: 0.3 } },
      { f: 5, a: 4.62, b: 6.1, safe: [0.08, 0.12, 0.92, 0.9], c: [0.5, 0.55, 0.36], zoom: [[0, 1.0], [0.72, 1.07], [1, 2.2]], panY: [[0, 0], [0.72, 0], [1, -0.2]], tr: { luma: 0.6, glow: 0.3 } },
      { f: 6, a: 5.6, b: 7.0, safe: [0.25, 0.1, 0.95, 0.9], c: [0.68, 0.22, 0.25], zoom: [[0, 0.84], [0.35, 1.06], [1, 1.0]], tr: { luma: 0.4, blur: 0.14, glow: 0.12 } },
      { f: 7, a: 6.62, b: 8.0, safe: [0.15, 0.1, 0.85, 0.9], c: [0.5, 0.3, 0.25], zoom: [[0, 1.04], [1, 1.0]], tr: { luma: 0.5, glow: 0.3 } },
      { f: 8, a: 7.62, b: 9.0, safe: [0.12, 0.1, 0.95, 0.85], c: [0.62, 0.55, 0.22], zoom: [[0, 1.05], [1, 1.0]], tr: { luma: 0.85, glow: 0.4 } },
      { f: 9, a: 8.62, b: 10.7, safe: [0.1, 0.1, 0.96, 0.86], c: [0.5, 0.55, 0.25], zoom: [[0, 1.04], [0.6, 1.0], [1, 1.0]], tr: { luma: 0.8, glow: 0.35 } }
    ]
  }
};
for (const set of Object.values(SETS)) for (const s of set.shots) {
  s.zoomT = track(s.zoom || [[0, 1], [1, 1]]); s.panXT = track(s.panX || [[0, 0], [1, 0]]); s.panYT = track(s.panY || [[0, 0], [1, 0]]); s.expT = track(s.exp || [[0, 1], [1, 1]]);
  s.tr = Object.assign({ luma: 0.6, blur: 0, glow: 0.3 }, s.tr || {});
}

export function createFilm(renderer, { taps = 7, particles = 1800, dpr = 1 } = {}) {
  /* ---------- the picture plate ---------- */
  const U = {
    tA: { value: null }, tB: { value: null }, fA: { value: new THREE.Vector4(1, 1, 0.5, 0.5) }, fB: { value: new THREE.Vector4(1, 1, 0.5, 0.5) },
    uP: { value: 1 }, uLuma: { value: 0.6 }, uGlow: { value: 0 }, uBlurA: { value: 0 }, uBlurB: { value: 0 }, uExpA: { value: 1 }, uExpB: { value: 1 },
    uAlpha: { value: 1 }, uTop: { value: 0 }
  };
  const plateMat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthTest: false, depthWrite: false,
    vertexShader: `uniform float uTop; varying vec2 vUv;
      void main(){ vUv=uv; float y=mix(-1.,1.-2.*uTop,uv.y); gl_Position=vec4(position.x,y,0.,1.); }`,
    fragmentShader: `uniform sampler2D tA, tB; uniform vec4 fA, fB; uniform float uP, uLuma, uGlow, uBlurA, uBlurB, uExpA, uExpB, uAlpha; varying vec2 vUv;
      // screen uv -> picture uv (texture space); window f = (width, height, centre x, centre y; picture y down)
      vec2 toPic(vec2 s, vec4 f){ return vec2(f.z+(s.x-.5)*f.x, 1.-(f.w+(.5-s.y)*f.y)); }
      vec3 pic(sampler2D t, vec2 uv){
        vec2 m=1.-abs(mod(uv,2.)-1.);
        float e=max(max(-uv.x,uv.x-1.),max(-uv.y,uv.y-1.));
        vec3 sharp=texture2D(t,clamp(uv,0.,1.)).rgb;
        float o=clamp(e,0.,2.);
        vec3 soft=texture2D(t,m,3.+o*16.).rgb*exp(-o*5.5);
        return mix(sharp,soft,smoothstep(-.025,.012,e));
      }
      vec3 shot(sampler2D t, vec4 f, float blur){
        if(blur<.001) return pic(t,toPic(vUv,f));
        vec3 c=vec3(0.);
        for(int k=0;k<${taps};k++){ float q=float(k)/${taps - 1}.; c+=pic(t,toPic(vUv+(.5-vUv)*blur*q,f)); }
        return c/${taps}.;
      }
      void main(){
        vec3 b=shot(tB,fB,uBlurB)*uExpB;
        vec3 col=b;
        if(uP<.999){
          vec3 a=shot(tA,fA,uBlurA)*uExpA;
          float lb=dot(b,vec3(.3,.55,.15));
          float k=smoothstep(0.,1.,uP*(1.+uLuma)-uLuma*(1.-clamp(lb*1.6,0.,1.)));
          col=mix(a,b,k)+(a+b)*uGlow*.5*sin(uP*3.14159);
        }
        float l=clamp(dot(col,vec3(.3,.55,.15))*1.6,0.,1.);
        gl_FragColor=vec4(col,clamp(uAlpha*1.7-.7*(1.-l),0.,1.));
      }`
  });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), plateMat);
  plate.frustumCulled = false;
  const plateScene = new THREE.Scene(); plateScene.add(plate);
  const plateCam = new THREE.Camera();

  /* ---------- real 3D particles in front of the plate ---------- */
  // view: at z=0 the screen spans y -1..1 and x -aspect..aspect; depth gives parallax
  const pCam = new THREE.PerspectiveCamera(40, 1, 0.05, 20);
  pCam.position.set(0, 0, 1 / Math.tan(20 * Math.PI / 180));
  const PU = {
    uT: { value: 0 }, uS: { value: 0 }, uC: { value: new THREE.Vector3(0, 0, 0.5) }, uAsp: { value: 1.6 }, uDpr: { value: dpr }, uH: { value: 800 }, uAlpha: { value: 1 },
    uW: { value: new THREE.Vector4() }, uW2: { value: new THREE.Vector2() }
  };
  const pGeo = new THREE.BufferGeometry();
  {
    let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const home = new Float32Array(particles * 3), rnd = new Float32Array(particles * 4);
    for (let i = 0; i < particles; i++) {
      home[i * 3] = r() * 2 - 1; home[i * 3 + 1] = r() * 2 - 1; home[i * 3 + 2] = r() * 2 - 1;
      rnd[i * 4] = r(); rnd[i * 4 + 1] = r(); rnd[i * 4 + 2] = r(); rnd[i * 4 + 3] = r();
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(home, 3));
    pGeo.setAttribute('aR', new THREE.BufferAttribute(rnd, 4));
  }
  const pMat = new THREE.ShaderMaterial({
    uniforms: PU, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec4 aR; uniform float uT, uS, uAsp, uDpr, uH, uAlpha; uniform vec3 uC; uniform vec4 uW; uniform vec2 uW2;
      varying float vA; varying float vK;
      const float TAU=6.28318;
      void main(){
        vec3 h=position; float ph=aR.x, sp=.4+aR.y;
        vec2 c=uC.xy; float R=uC.z;
        // dust: slow drift through the whole volume
        vec3 dust=vec3(h.x*uAsp*1.15+sin(uT*.05*sp+ph*TAU)*.08, h.y*1.1+cos(uT*.04*sp+ph*9.)*.06, h.z*.9);
        // energy ring round the subject, tilted like the storyboard orbits
        float a=ph*TAU+uT*(.25+.35*aR.z);
        vec3 ring=vec3(c.x+cos(a)*R*1.45, c.y+sin(a)*R*.32+sin(a*3.+ph*20.)*.015, sin(a)*.6)+vec3(0.,0.,0.)*h;
        // stream: out of the subject to the right, curling
        float u=fract(ph+uT*.09*sp);
        vec3 stream=vec3(c.x+u*(2.4*uAsp)*.6, c.y+(aR.z-.5)*R*1.2*(1.-u*.4)+sin(u*7.+ph*12.)*.08*u, (aR.w-.5)*1.2+sin(u*5.+ph*8.)*.25);
        // spiral into the sphere surface
        float g=clamp(uW2.x,0.,1.); float sa=ph*TAU+(1.-g)*7.+uT*.15; float rr=R*mix(2.6+aR.z*1.2,1.,g);
        vec3 spiral=vec3(c.x+cos(sa)*rr*(.85+.15*aR.w), c.y+sin(sa)*rr*(.85+.15*aR.w)*.95, sin(sa*.5+ph*5.)*.4*(1.-g));
        // warp: rushing past the camera out of the subject
        float wv=fract(ph+uT*.55*sp); vec2 wd=normalize(h.xy+vec2(.001));
        vec3 warp=vec3(c+wd*(.05+wv*wv*2.6), -1.+wv*2.2);
        // form: light settling into the subject (AI)
        vec3 form=vec3(c.x+(aR.z-.5)*R*1.9, c.y+(aR.w-.5)*R*2.2, (h.z)*.15);
        float wd0=max(1.-uW.x-uW.y-uW.z-uW.w-uW2.y,0.);
        vec3 p=dust*wd0+ring*uW.x+stream*uW.y+spiral*uW.z+warp*uW.w+form*uW2.y;
        vec4 mv=modelViewMatrix*vec4(p,1.);
        gl_Position=projectionMatrix*mv;
        float tw=.55+.45*sin(uT*(1.5+aR.y*3.)+ph*40.);
        vK=step(.93,aR.w);   // a few bigger star sparks
        float size=(vK>.5?.03:.007+.006*aR.z)*(1.+uW.w*2.5);
        gl_PointSize=clamp(size*uH*uDpr/-mv.z,1.,40.);
        vA=tw*uAlpha*(.12*wd0+.6*uW.x+.55*uW.y+.6*uW.z+.75*uW.w+.6*uW2.y)*(vK>.5?1.2:1.);
      }`,
    fragmentShader: `varying float vA; varying float vK;
      void main(){ vec2 q=gl_PointCoord-.5; float d=length(q); float a;
        if(vK>.5) a=exp(-d*d*220.)*1.5+exp(-abs(q.x)*60.)*exp(-abs(q.y)*8.)*.8+exp(-abs(q.y)*60.)*exp(-abs(q.x)*8.)*.8;
        else { a=smoothstep(.5,0.,d); a*=a; }
        gl_FragColor=vec4(vec3(.55,.8,1.)*a*vA,1.); }`
  });
  const pts = new THREE.Points(pGeo, pMat); pts.frustumCulled = false;
  const pScene = new THREE.Scene(); pScene.add(pts);

  /* ---------- pictures: loaded on demand, only the ones near the current shot on the GPU ---------- */
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  let set = null, name = '', imgs = [], ok = [], texs = [], aspect = 1.6;
  function use(n) {
    if (n === name) return;
    texs.forEach(t => t && t.dispose());
    name = n; set = SETS[n]; imgs = []; ok = []; texs = [];
    const load = i => {
      if (imgs[i]) return;
      const im = new Image(); im.decoding = 'async'; imgs[i] = im;
      im.onload = () => { ok[i] = true; if (i === 0) set.files.forEach((_, j) => load(j)); };
      im.src = new URL(`./film/${set.files[i]}.webp`, import.meta.url).href;
    };
    load(0);
  }
  function tex(i) {
    if (!ok[i]) return null;
    if (!texs[i]) {
      const t = new THREE.Texture(imgs[i]);
      t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = maxAniso; t.needsUpdate = true;
      renderer.initTexture(t); texs[i] = t;
    }
    return texs[i];
  }
  // the window onto a picture for this screen: covers the screen if it can, always holds the safe box
  function framing(s, u, out) {
    const im = imgs[s.f], ai = im.naturalWidth / im.naturalHeight;
    let ex, ey;
    if (aspect > ai) { ex = 1; ey = ai / aspect; } else { ey = 1; ex = aspect / ai; }
    const [x0, y0, x1, y1] = s.safe;
    const k = Math.max(1, (x1 - x0) * 1.04 / ex, (y1 - y0) * 1.04 / ey);
    const z = s.zoomT(u); ex = ex * k / z; ey = ey * k / z;
    let cx = (x0 + x1) / 2 + s.panXT(u), cy = (y0 + y1) / 2 + s.panYT(u);
    cx = ex >= 1 ? mix(0.5, cx, clamp(2 - ex)) : clamp(cx, ex / 2, 1 - ex / 2);
    cy = ey >= 1 ? mix(0.5, cy, clamp(2 - ey)) : clamp(cy, ey / 2, 1 - ey / 2);
    out.set(ex, ey, cx, cy);
  }
  // where the shot's subject sits on screen, in particle space (x -asp..asp, y -1..1) with its radius
  const _f = new THREE.Vector4();
  function subject(s, u, out) {
    framing(s, u, _f);
    const [px, py, pr] = s.c;
    const sx = 0.5 + (px - _f.z) / _f.x, sy = 0.5 - (py - _f.w) / _f.y;
    out.set((sx * 2 - 1) * aspect, sy * 2 - 1, pr * 2 / _f.y);
  }
  const uOf = (s, S) => clamp((S - s.a) / (s.b - s.a));
  const cA = new THREE.Vector3(), cB = new THREE.Vector3();

  return {
    use, get name() { return name; },
    setAspect(a, top, h) { aspect = a; U.uTop.value = top; PU.uAsp.value = a; pCam.aspect = a; pCam.updateProjectionMatrix(); PU.uH.value = h / (2 * Math.tan(20 * Math.PI / 180)); },
    // draws the film for timeline value S at time t; alpha fades it (start and hand-over to the page)
    render(S, alpha, t) {
      if (!set) return false;
      const shots = set.shots;
      let i = shots.findIndex(s => S < s.b); if (i < 0) i = shots.length - 1;
      for (let j = 0; j < shots.length; j++) {
        const near = j >= i - 1 && j <= i + 2;
        if (near) tex(shots[j].f); else if (texs[shots[j].f]) { texs[shots[j].f].dispose(); texs[shots[j].f] = null; }
      }
      const cur = shots[i], next = shots[i + 1];
      const inT = next && S > next.a;
      const B = inT ? next : cur, A = cur;
      const tb = tex(B.f), ta = tex(A.f);
      if (!tb && !ta) return false;
      const p = inT ? sstep(0, 1, (S - next.a) / (cur.b - next.a)) : 1;
      framing(A, uOf(A, S), U.fA.value); framing(B, uOf(B, S), U.fB.value);
      U.tA.value = ta || tb; U.tB.value = tb || ta;
      U.uP.value = tb && ta ? p : 1;
      if (!tb) U.fB.value.copy(U.fA.value);
      U.uLuma.value = B.tr.luma; U.uGlow.value = inT ? B.tr.glow : 0;
      U.uBlurA.value = inT ? B.tr.blur * sstep(0, 1, p * 1.4) : 0;
      U.uBlurB.value = inT ? B.tr.blur * (1 - sstep(0, 1, p)) : 0;
      U.uExpA.value = A.expT(uOf(A, S)); U.uExpB.value = B.expT(uOf(B, S));
      U.uAlpha.value = alpha;
      renderer.render(plateScene, plateCam);
      // particles: one formation per scene, flowing from one into the next
      if (ok[A.f] && ok[B.f]) {
        subject(A, uOf(A, S), cA); subject(B, uOf(B, S), cB);
        PU.uC.value.copy(cA).lerp(cB, p);
        PU.uC.value.z = Math.min(PU.uC.value.z, 0.9);
      }
      PU.uT.value = t; PU.uS.value = S; PU.uAlpha.value = alpha;
      PU.uW.value.set(band(S, 0.6, 1.3, 2.0, 2.5), band(S, 2.05, 2.5, 3.5, 3.95), band(S, 3.4, 3.9, 4.6, 5.2), band(S, 6.35, 6.6, 6.95, 7.25));
      PU.uW2.value.set(sstep(3.6, 4.7, S), band(S, 8.3, 8.7, 9.3, 9.8));
      renderer.render(pScene, pCam);
      return true;
    },
    dispose() {
      texs.forEach(t => t && t.dispose());
      plate.geometry.dispose(); plateMat.dispose(); pGeo.dispose(); pMat.dispose();
    }
  };
}
