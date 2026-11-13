/* Bergmann AI: the intro in front of the page, then the earth turning behind it.

   One timeline value S follows the scroll position:
     0 .. 10   the intro (film.js): the word "Bergmann", the end picture (AI and the earth) seen through
               its letters; scrolling flies into the letters until the picture stands alone, then it holds
     10 .. 11  hand-over: the picture fades, the 3D globe behind it pulls back into place
     11        the page: the earth only turns in the background
   Scroll: GSAP ScrollTrigger (assets/vendor) reads it, gsap.quickTo smooths S; without GSAP a plain
   scroll listener and an own easing do the same. The globe behind the page gets a light bloom (bloom.js).
   Without WebGL the original AI picture (assets/img/hero-ai-1600.webp) stands in. */
import * as THREE from './three.module.min.js';
import { createFilm } from './film.js';
import { createBloom } from './bloom.js';

const canvas = document.getElementById('earth3d');
const intro = document.getElementById('intro');
const nav = document.querySelector('.nav');
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = matchMedia('(max-width: 700px), (pointer: coarse)').matches;

function fail() {
  if (root.classList.contains('no-3d')) return;
  const y = scrollY, h = intro && intro.offsetParent ? intro.offsetHeight : 0;
  root.classList.add('no-3d');
  if (h && y > 0) scrollTo(0, Math.max(0, y - h));
}

function clamp(x, a = 0, b = 1) { return Math.min(b, Math.max(a, x)); }
function sstep(a, b, x) { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); }
function mix(a, b, t) { return a + (b - a) * t; }
function track(pts) { // [[S, value], ...] eased between the keys
  return s => {
    if (s <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (s <= pts[i][0]) return mix(pts[i - 1][1], pts[i][1], sstep(pts[i - 1][0], pts[i][0], s));
    return pts[pts.length - 1][1];
  };
}
function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;
const ADD = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };

let renderer;
function start() {
  // the intro gets the sharpest pixels (one picture quad); the globe behind the page less
  const dev = window.devicePixelRatio || 1;
  const FILM_DPR = Math.min(dev, 2), BG_DPR = Math.min(dev, small ? 1.5 : 1.75);
  let dpr = FILM_DPR;
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x02040b, 1);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // shaders write display values directly
  renderer.autoClear = false;
  const bloom = createBloom(renderer, small ? { levels: 3, scale: 0.34, msaa: 0, strength: 0.7, threshold: 0.6 } : { levels: 4, scale: 0.5, msaa: 4, strength: 0.85, threshold: 0.6 });
  const film = createFilm(renderer);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 400);
  const D2R = Math.PI / 180;
  const T = { value: 0 };                   // time in seconds (frozen with reduced motion)
  const SUN = { value: new THREE.Vector3(1, 0.3, 0.2).normalize() };
  const EC = new THREE.Vector3(0, 0.1, 0);
  const rnd = rng(7);

  /* ================= sky: nebula and stars ================= */
  const sky = new THREE.Group(); scene.add(sky);
  {
    const m = new THREE.Mesh(new THREE.SphereGeometry(160, 48, 32), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: `varying vec3 vD; void main(){ vD=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `${NOISE} varying vec3 vD;
        void main(){ vec3 d=normalize(vD);
          float n=snoise(d*1.7)*.5+snoise(d*3.6+7.)*.3+snoise(d*7.4+3.)*.2;
          float neb=smoothstep(.0,.8,n);
          float band=exp(-pow(dot(d,normalize(vec3(.42,1.,.3)))*2.6,2.));
          float low=smoothstep(.15,-.6,d.y);
          float m=neb*(.25+.55*band+.45*low);
          gl_FragColor=vec4(vec3(.006,.012,.034)+vec3(.03,.065,.17)*m+vec3(.025,.02,.07)*neb*band*.5,1.); }`
    }));
    m.renderOrder = -10; sky.add(m);
    const n = small ? 1500 : 2800, pos = new Float32Array(n * 3), sz = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u), R = 120;
      pos[i * 3] = R * s * Math.cos(a); pos[i * 3 + 1] = R * u; pos[i * 3 + 2] = R * s * Math.sin(a);
      sz[i] = rnd() < 0.07 ? 2.5 : 0.7 + rnd() * 1.1;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
    const st = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { dpr: { value: BG_DPR }, uTime: T },
      vertexShader: `attribute float aSize; uniform float dpr, uTime; varying float vS; varying float vT;
        void main(){ vS=aSize; vT=.75+.25*sin(uTime*1.3+position.x*.7+position.y); gl_PointSize=aSize*dpr; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `varying float vS; varying float vT; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.05,d); gl_FragColor=vec4(.82,.9,1.,a*(.32+.25*vS)*vT); }`
    }));
    st.renderOrder = -9; sky.add(st);
  }

  /* ================= earth ================= */
  const earthTilt = new THREE.Group(); earthTilt.position.copy(EC); earthTilt.rotation.z = 0.3; scene.add(earthTilt);
  const EU = { map: { value: null }, sunDir: SUN, uTime: T, uLights: { value: 1 }, uDay: { value: 1 } };
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, small ? 96 : 144, small ? 64 : 96), new THREE.ShaderMaterial({
    uniforms: EU,
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying vec3 vP;
      void main(){ vUv=uv; vP=position; vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `${NOISE} uniform sampler2D map; uniform vec3 sunDir; uniform float uTime, uLights, uDay; varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying vec3 vP;
      void main(){
        vec3 t=texture2D(map,vUv).rgb; float land=t.r; float lights=pow(t.g,1.6)*1.3;
        vec3 N=normalize(vN); vec3 V=normalize(cameraPosition-vW);
        float ndl=dot(N,sunDir); float day=smoothstep(-.1,.3,ndl); float night=1.-smoothstep(-.22,.06,ndl);
        vec3 q=vP*2.2+vec3(uTime*.004,0.,0.);
        float c=snoise(q)*.55+snoise(q*2.1+3.)*.28+snoise(q*4.4+7.)*.15${small ? '' : '+snoise(q*9.+1.)*.07'};
        float cloud=smoothstep(.1,.6,c);
        vec3 dayCol=mix(vec3(.012,.05,.19),vec3(.12,.19,.34),land);
        dayCol=mix(dayCol,vec3(.66,.77,.92),cloud*.82)*(.16+1.05*max(ndl,0.))*uDay;
        vec3 nightCol=mix(vec3(.004,.012,.04),vec3(.014,.03,.08),land)+vec3(.012,.02,.045)*cloud;
        vec3 col=mix(nightCol,dayCol,day);
        float tw=.9+.1*sin(uTime*1.7+vUv.x*900.+vUv.y*700.);
        col+=vec3(1.,.78,.5)*lights*night*(1.-cloud*.65)*1.55*tw*uLights;
        vec3 H=normalize(sunDir+V); col+=vec3(.45,.65,1.)*pow(max(dot(N,H),0.),70.)*(1.-land)*(1.-cloud)*day*.55*uDay;
        float fr=pow(1.-max(dot(N,V),0.),3.);
        col+=vec3(.16,.42,1.)*fr*(.22+.95*smoothstep(-.45,.35,ndl));
        col+=vec3(.25,.5,1.)*smoothstep(-.18,.02,ndl)*(1.-smoothstep(.02,.3,ndl))*.18;
        gl_FragColor=vec4(col,1.);
      }`
  }));
  earthTilt.add(earth);
  earthTilt.add(new THREE.Mesh(new THREE.SphereGeometry(1.11, 96, 64), new THREE.ShaderMaterial({
    uniforms: { sunDir: SUN }, side: THREE.BackSide, ...ADD,
    vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 sunDir; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 V=normalize(cameraPosition-vW); vec3 N=normalize(vN);
        float rim=pow(clamp(abs(dot(N,V))/.45,0.,1.),2.4);
        float lit=.2+1.2*smoothstep(-.6,.5,dot(N,sunDir));
        gl_FragColor=vec4(vec3(.25,.55,1.)*rim*lit*1.3,rim*lit); }`
  })));

  // light routes between cities
  const ll = (lon, lat, r = 1) => { const phi = (90 - lat) * D2R, th = (lon + 180) * D2R; return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th)); };
  const routeGain = { value: 0 };
  {
    const C = { hal: [8.36, 52.06], ber: [13.4, 52.52], par: [2.35, 48.86], lon: [-0.13, 51.5], mad: [-3.7, 40.4], rom: [12.5, 41.9], ist: [28.97, 41.0], mos: [37.6, 55.75], cai: [31.2, 30.0], dub: [55.3, 25.2], nyc: [-74, 40.7], sto: [18.07, 59.33], war: [21, 52.2], vie: [16.37, 48.2], lis: [-9.14, 38.72], del: [77.2, 28.6], lag: [3.4, 6.5] };
    const pairs = [['hal', 'ber'], ['hal', 'par'], ['hal', 'lon'], ['hal', 'vie'], ['hal', 'sto'], ['hal', 'rom'], ['hal', 'mad'], ['ber', 'war'], ['war', 'mos'], ['vie', 'ist'], ['ist', 'dub'], ['rom', 'cai'], ['lon', 'nyc'], ['par', 'lis'], ['dub', 'del'], ['mad', 'lag'], ['mos', 'del'], ['cai', 'dub']];
    const pos = [], aT = [], aO = [], idx = []; let base = 0;
    pairs.forEach(([a, b], k) => {
      const A = ll(...C[a]), B = ll(...C[b]), ang = A.angleTo(B), N = 64, h = 0.02 + ang * 0.16;
      for (let i = 0; i <= N; i++) { const t = i / N, p = A.clone().lerp(B, t).normalize().multiplyScalar(1.004 + Math.sin(t * Math.PI) * h); pos.push(p.x, p.y, p.z); aT.push(t); aO.push((k * 0.37) % 1); if (i < N) idx.push(base + i, base + i + 1); }
      base += N + 1;
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1)); g.setAttribute('aO', new THREE.Float32BufferAttribute(aO, 1)); g.setIndex(idx);
    earth.add(new THREE.LineSegments(g, new THREE.ShaderMaterial({
      ...ADD, uniforms: { uTime: T, uGain: routeGain },
      vertexShader: `attribute float aT; attribute float aO; varying float vT; varying float vO; void main(){ vT=aT; vO=aO; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform float uTime, uGain; varying float vT; varying float vO;
        void main(){ float p=fract(uTime*.11+vO); float d=vT-p; float head=smoothstep(.0,.012,d+.012)*(1.-smoothstep(.0,.012,d)); float tail=smoothstep(-.28,0.,d)*step(d,0.);
          gl_FragColor=vec4(vec3(.56,.89,1.)*(.1+tail*.75+head*2.2)*sin(vT*3.14159)*uGain,1.); }`
    })));
  }

  /* ================= sun: soft glare beyond the limb and a star burst on it ================= */
  function spriteTex(draw) { const c = document.createElement('canvas'); c.width = c.height = 512; draw(c.getContext('2d'), 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t; }
  const glare = new THREE.Sprite(new THREE.SpriteMaterial({
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    map: spriteTex((g, h) => { const r = g.createRadialGradient(h, h, 0, h, h, h); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.05, 'rgba(220,238,255,.9)'); r.addColorStop(0.2, 'rgba(110,165,255,.42)'); r.addColorStop(0.5, 'rgba(50,100,255,.12)'); r.addColorStop(1, 'rgba(30,70,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 2 * h, 2 * h); })
  }));
  const burst = new THREE.Sprite(new THREE.SpriteMaterial({
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true,
    map: spriteTex((g, h) => {
      const r = g.createRadialGradient(h, h, 0, h, h, h * 0.5); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.08, 'rgba(235,245,255,.95)'); r.addColorStop(0.3, 'rgba(140,190,255,.35)'); r.addColorStop(1, 'rgba(60,120,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, 2 * h, 2 * h);
      g.globalCompositeOperation = 'lighter';
      for (const [ang, len, wd, al] of [[0, 1, 5, 0.9], [90, 0.55, 4, 0.55], [30, 0.36, 2, 0.35], [150, 0.36, 2, 0.35], [60, 0.28, 2, 0.25], [120, 0.28, 2, 0.25]]) {
        g.save(); g.translate(h, h); g.rotate(ang * D2R);
        const lg = g.createLinearGradient(-h * len, 0, h * len, 0); lg.addColorStop(0, 'rgba(120,170,255,0)'); lg.addColorStop(0.5, `rgba(235,245,255,${al})`); lg.addColorStop(1, 'rgba(120,170,255,0)');
        g.fillStyle = lg; g.beginPath(); g.ellipse(0, 0, h * len, wd, 0, 0, Math.PI * 2); g.fill(); g.restore();
      }
    })
  }));
  burst.renderOrder = 50; scene.add(glare, burst);

  /* ================= camera: from close under the end frame back to the page globe ================= */
  const V3 = () => new THREE.Vector3();
  let aspect = 1, fovV = 38;
  // camera at (az, el, d) from the earth centre, which then appears at screen angle (ox, oy)
  function aim(o) {
    const el = o.el * D2R, az = o.az * D2R, u = V3().set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    const pos = EC.clone().addScaledVector(u, o.d), v = u.clone().negate();
    const U0 = V3().set(0, 1, 0).addScaledVector(v, -v.y).normalize(), R0 = V3().crossVectors(v, U0);
    const F = v.clone().addScaledVector(R0, -Math.tan(o.ox * D2R)).addScaledVector(U0, -Math.tan(o.oy * D2R)).normalize();
    return { pos, F, U: U0.clone().addScaledVector(F, -U0.dot(F)).normalize() };
  }
  const L = (p, l) => mix(p, l, sstep(0.75, 1.45, aspect));   // portrait value, landscape value
  let K0, K1;
  function evalShots() {
    K0 = aim({ az: -95, el: 10, d: L(3.6, 3.2), ox: L(0, -4), oy: L(-8, -9) });   // under the end frame
    K1 = aim({ az: -110, el: 14, d: L(5.4, 4.6), ox: 0, oy: L(-7, -4.5) });       // behind the page
  }
  const camPos = V3(), camF = V3(), camU = V3(), _d = V3(), _l = V3();
  function shotAt(t) {
    const e = sstep(0, 1, t), d0 = K0.pos.distanceTo(EC), d1 = K1.pos.distanceTo(EC);
    _d.copy(K0.pos).sub(EC).normalize().lerp(_l.copy(K1.pos).sub(EC).normalize(), e).normalize();
    camPos.copy(EC).addScaledVector(_d, Math.exp(mix(Math.log(d0), Math.log(d1), e)));
    camF.copy(K0.F).lerp(K1.F, e).normalize();
    camU.copy(K0.U).lerp(K1.U, e); camU.addScaledVector(camF, -camU.dot(camF)).normalize();
  }

  /* ================= scroll -> timeline ================= */
  const HOLD = 1.3;   // the end frame stands for a longer stretch before the page arrives
  let introTop = 0, introLen = 1, S = reduce ? 11 : 0, target = S, auto = reduce ? 1 : 0, bgSpin = 0, lastY = scrollY, depth = 0, depthT = 0;
  function measure() {
    const on = intro && intro.offsetParent !== null && getComputedStyle(intro).display !== 'none';
    if (on) { introTop = intro.getBoundingClientRect().top + scrollY; introLen = Math.max(1, intro.offsetHeight - innerHeight); }
    else { introTop = 0; introLen = 0; }
  }
  function readScroll() {
    if (reduce) { target = 11; return; }
    const y = scrollY;
    if (!introLen) target = 11;
    else {
      const f = (y - introTop) / introLen;
      target = f <= 1 ? clamp(f * (10 + HOLD), 0, 10) : 10 + clamp((y - introTop - introLen) / (innerHeight * 0.8));
    }
    // below the hero the page is text: the earth steps back a little
    depthT = clamp((y - introTop - introLen - innerHeight * 1.2) / innerHeight);
    bgSpin += (y - lastY) * 0.00025 * sstep(10.2, 11, S); lastY = y;
  }
  // GSAP ScrollTrigger reads the scroll (and re-measures on layout changes); quickTo smooths S
  const G = window.gsap, ST = window.ScrollTrigger, prox = { s: S };
  let sTo = null;
  if (G && ST && intro && !reduce) {
    G.registerPlugin(ST);
    sTo = G.quickTo(prox, 's', { duration: 0.85, ease: 'power3.out' });
    ST.create({ trigger: intro, start: 'top top', endTrigger: '#start', end: 'bottom top', onUpdate: onScroll, onRefresh: () => { measure(); onScroll(); } });
  }
  function onScroll() {
    readScroll();
    if (!sTo) return;
    const d = target - prox.s;   // a jump (anchor link) plays at most 1.6 scenes
    if (Math.abs(d) > 1.6) sTo(target, target - Math.sign(d) * 1.6); else sTo(target);
  }
  addEventListener('scroll', onScroll, { passive: true });

  function resize() {
    const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); bloom.setSize();
    aspect = w / h; fovV = mix(58, 38, sstep(0.6, 1.4, aspect));
    camera.aspect = aspect; camera.fov = fovV; camera.updateProjectionMatrix();
    // the film fills the screen under the opaque header
    const top = nav ? Math.min(nav.offsetHeight, h * 0.2) : 0;
    film.use(aspect < 0.95 ? 'tall' : 'wide');
    film.setAspect(w / (h - top), top / h);
    measure(); evalShots(); readScroll();
  }
  addEventListener('resize', resize);
  resize();
  S = prox.s = target;

  // the earth texture is needed only behind the page: loaded once the intro stands
  (window.requestIdleCallback || (f => setTimeout(f, 600)))(() => {
    const tex = new THREE.TextureLoader().load(new URL(small ? './earth-2k.webp' : './earth-4k.webp', import.meta.url).href);
    tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    EU.map.value = tex;
  }, { timeout: 2500 });

  /* ================= per frame ================= */
  const sunAlpha = track([[10, -10], [11, -48]]), sunLight = track([[10, 30], [11, 72]]), burstK = track([[10, 0.7], [11, 0.38]]);
  const v = V3(), w = V3(), sdir = V3(), lim = V3(), look = V3();
  function sun(alphaDeg, lightOff, gain) {
    v.copy(EC).sub(camera.position); const d = v.length(); v.normalize();
    const th = Math.asin(Math.min(0.999, 1 / d));
    w.copy(camU).addScaledVector(v, -camU.dot(v)).normalize().applyAxisAngle(v, -alphaDeg * D2R);
    const pl = th + lightOff * D2R;
    SUN.value.copy(v).multiplyScalar(Math.cos(pl)).addScaledVector(w, Math.sin(pl)).normalize();
    const limbDist = Math.sqrt(Math.max(d * d - 1, 1e-4));
    lim.copy(v).multiplyScalar(Math.cos(th)).addScaledVector(w, Math.sin(th));
    burst.position.copy(camera.position).addScaledVector(lim, limbDist * 0.985);
    burst.scale.setScalar(limbDist * 0.42 * Math.min(gain, 1.2));
    burst.material.opacity = clamp(gain);
    sdir.copy(v).multiplyScalar(Math.cos(th + 0.035)).addScaledVector(w, Math.sin(th + 0.035));
    glare.position.copy(camera.position).addScaledVector(sdir, 80);
    glare.scale.setScalar(80 * 0.45);
    glare.material.opacity = clamp(gain * 0.75);
    glare.visible = burst.visible = gain > 0.01;
  }

  function update3d(s, dt) {
    depth += (depthT - depth) * Math.min(1, dt * 3);
    EU.uLights.value = mix(1.1, 0.75, sstep(10, 11, s)) * (1 - 0.45 * depth);
    EU.uDay.value = 0.7 * (1 - 0.3 * depth);
    if (s > 10.3) bgSpin += dt * 0.032 * (reduce ? 0 : 1) * sstep(10.3, 11, s);
    earth.rotation.y = 3.5 + bgSpin + T.value * 0.004;
    routeGain.value = sstep(10.4, 11, s);
    shotAt(s - 10);
    camera.position.copy(camPos); camera.up.copy(camU); camera.lookAt(look.copy(camPos).add(camF));
    camera.updateMatrixWorld();
    sky.position.copy(camera.position);
    sun(sunAlpha(s), sunLight(s), burstK(s) * (1 - 0.5 * depth));
  }

  let visible = !document.hidden, last = performance.now(), born = 0, frames = 0, odd = false;
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible) { last = performance.now(); requestAnimationFrame(frame); } });
  function frame(now) {
    if (!visible) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!reduce) T.value += dt;
    if (!born && film.ready) born = now;   // the word arrives once its pictures are there
    auto = reduce || S > 10.02 ? 1 : born ? sstep(80, 1900, now - born) : 0;
    if (sTo) S = prox.s;
    else {
      if (Math.abs(target - S) > 1.6) S = target - Math.sign(target - S) * 1.6;   // a jump (anchor link) plays at most 1.6 scenes
      S += (target - S) * (reduce ? 1 : 1 - Math.pow(0.006, dt));
      if (Math.abs(target - S) < 1e-4) S = target;
    }
    // behind the page the globe only turns: half the frame rate is enough there
    const resting = S > 10.98 && Math.abs(target - S) < 1e-3;
    if (!(resting && (odd = !odd))) {
      const want = S < 10.65 ? FILM_DPR : BG_DPR;
      if (want !== dpr) { dpr = want; renderer.setPixelRatio(dpr); renderer.setSize(innerWidth, innerHeight, false); bloom.setSize(); }
      renderer.setRenderTarget(null); renderer.clear();
      const filmAlpha = Math.min(auto, 1 - sstep(10.04, 10.5, S));
      if (S > 10.02) { update3d(S, resting ? dt * 2 : dt); bloom.fade.value = sstep(10.12, 10.6, S); bloom.render(scene, camera); }
      let drawn = false;
      if (filmAlpha > 0.002) drawn = film.render(S, filmAlpha, T.value);
      if (drawn || S > 10.02) { if (++frames === 2) canvas.classList.add('is-ready'); }
    }
    syncUi();
    requestAnimationFrame(frame);
  }
  let uiP = -1;
  function syncUi() {
    if (!intro) return;
    const p = Math.round(clamp(S / 10) * 1000) / 1000;
    if (p === uiP) return; uiP = p;
    intro.style.setProperty('--ip', p);
    root.classList.toggle('film-moved', S > 0.12);
    root.classList.toggle('film-done', S > 9.6);
    root.classList.toggle('film-over', S > 10.3);
  }
  requestAnimationFrame(frame);
  renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); fail(); });
  // free the GPU when the page goes away (kept when it is only parked for back/forward)
  addEventListener('pagehide', e => {
    if (e.persisted) return;
    visible = false;
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => { if (x.map) x.map.dispose(); x.dispose(); }); });
    if (EU.map.value) EU.map.value.dispose();
    film.dispose(); bloom.dispose(); renderer.dispose();
  });
  window.__scene = {
    get S() { return S; }, get target() { return target; },
    set: s => { target = S = prox.s = s; if (sTo) sTo(s, s); },
    snap: () => { readScroll(); S = prox.s = target; if (sTo) sTo(target, target); }
  };
}

try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
} catch (e) { fail(); }
if (renderer) { try { start(); } catch (e) { console.error(e); fail(); } }
