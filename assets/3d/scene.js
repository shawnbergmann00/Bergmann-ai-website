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

  /* ================= sky: black space, faint stars ================= */
  const sky = new THREE.Group(); scene.add(sky);
  {
    const n = small ? 1200 : 2200, pos = new Float32Array(n * 3), sz = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u), R = 120;
      pos[i * 3] = R * s * Math.cos(a); pos[i * 3 + 1] = R * u; pos[i * 3 + 2] = R * s * Math.sin(a);
      sz[i] = rnd() < 0.05 ? 2 : 0.6 + rnd() * 0.9;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
    const st = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { dpr: { value: BG_DPR } },
      vertexShader: `attribute float aSize; uniform float dpr; varying float vS;
        void main(){ vS=aSize; gl_PointSize=aSize*dpr; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `varying float vS; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.05,d); gl_FragColor=vec4(.86,.9,1.,a*(.16+.16*vS)); }`
    }));
    st.renderOrder = -9; sky.add(st);
  }

  /* ================= earth: real satellite pictures (4K on desktop, 2K on phones) =================
     day surface, night lights and the cloud layer from NASA Blue Marble / Black Marble based maps
     (Solar System Scope, CC BY 4.0). Lit in linear light: soft terminator, sunlight reddened where it
     grazes, darker deep ocean with a sun glint, cloud shadows, city lights dimmed under clouds, and the
     air seen through toward the limb. */
  const earthTilt = new THREE.Group(); earthTilt.position.copy(EC); earthTilt.rotation.z = 0.3; scene.add(earthTilt);
  const EU = { tDay: { value: null }, tNight: { value: null }, tClouds: { value: null }, sunDir: SUN, uTime: T, uLights: { value: 1 }, uDay: { value: 1 }, uReady: { value: 0 } };
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, small ? 128 : 192, small ? 64 : 96), new THREE.ShaderMaterial({
    uniforms: EU,
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform sampler2D tDay, tNight, tClouds; uniform vec3 sunDir; uniform float uTime, uLights, uDay, uReady; varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){
        vec3 N=normalize(vN), V=normalize(cameraPosition-vW), L=sunDir;
        float ndl=dot(N,L), mu=max(dot(N,V),0.);
        vec3 ground=pow(texture2D(tDay,vUv).rgb,vec3(2.2));
        float ocean=smoothstep(.03,.12,ground.b-max(ground.r,ground.g));
        ground=mix(ground,ground*vec3(.28,.45,.7),ocean*.75);                    // open ocean is darker than the map
        float cl=smoothstep(.1,.9,texture2D(tClouds,vUv+vec2(uTime*.0009,0.)).r);  // clouds drift slowly
        float sh=smoothstep(.1,.9,texture2D(tClouds,vUv+vec2(uTime*.0009+.0025,.0015)).r);
        // sunlight, reddened where it grazes through the air
        float tw=(1.-smoothstep(0.,.14,ndl))*smoothstep(-.08,.02,ndl);
        vec3 sun=mix(vec3(1.,.97,.93),vec3(1.,.5,.26),tw*.45);
        float dif=clamp((ndl+.03)/1.03,0.,1.);
        vec3 col=ground*sun*dif*1.7*(1.-sh*.4);
        vec3 H=normalize(L+V);
        col+=sun*pow(max(dot(N,H),0.),110.)*ocean*(1.-cl)*smoothstep(0.,.2,ndl)*.55;  // glint on the sea
        vec3 cloud=vec3(.9,.92,.95)*sun*clamp((ndl+.08)/1.08,0.,1.)*1.45;
        col=mix(col,cloud,cl*.94);
        // night side: city lights, dimmed under clouds; cloud tops faintly lit by the moon
        float night=1.-smoothstep(-.16,.03,ndl);
        vec3 lights=pow(max(texture2D(tNight,vUv).rgb-vec3(.055,.06,.11),0.)*1.15,vec3(2.2));   // the lights only, without the map's blue ground
        col+=lights*vec3(1.,.92,.8)*2.6*uLights*night*(1.-cl*.8);
        col+=vec3(.003,.005,.009)*cl*night;
        // looking through the air: blue in-scatter toward the limb on the lit side, a warm band at dawn
        float path=1./(mu*.88+.12);
        float lit=smoothstep(-.25,.3,ndl);
        vec3 air=vec3(.1,.27,.8)*(1.-exp(-path*.07))*lit*1.1+vec3(1.,.42,.16)*tw*(1.-exp(-path*.05))*.6;
        col=col*exp(-path*.03*lit)+air;
        col*=uDay*uReady;
        gl_FragColor=vec4(pow(col,vec3(1./2.2)),1.);
      }`
  }));
  earthTilt.add(earth);
  // the air around the limb: a thin glow, blue where the sun reaches it, warm at sunrise, brighter toward the sun
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.07, 128, 64), new THREE.ShaderMaterial({
    uniforms: { sunDir: SUN, uC: { value: EC }, uReady: EU.uReady }, side: THREE.BackSide, ...ADD,
    vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 sunDir, uC; uniform float uReady; varying vec3 vW;
      void main(){
        vec3 rd=normalize(vW-cameraPosition); float t=dot(uC-cameraPosition,rd);
        vec3 P=cameraPosition+rd*t; float b=length(P-uC);
        float h=max(b-1.,0.);
        float dens=exp(-h/.016)*(1.-smoothstep(.055,.07,h));
        vec3 n=normalize(P-uC); float s=dot(n,sunDir);
        vec3 blue=vec3(.22,.48,1.)*smoothstep(-.2,.4,s);
        vec3 dawn=vec3(1.,.45,.18)*exp(-pow((s-.02)/.13,2.));
        float fwd=pow(max(dot(rd,sunDir),0.),6.);
        vec3 c=(blue+dawn*.6)*(.55+fwd*2.5)*dens*uReady;
        gl_FragColor=vec4(c,1.);
      }`
  }));
  earthTilt.add(atmo);

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

  // the earth pictures are needed only behind the page: loaded once the intro stands
  (window.requestIdleCallback || (f => setTimeout(f, 600)))(() => {
    const k = small ? '2k' : '4k', aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    let left = 3;
    const load = (name, key) => {
      const tex = new THREE.TextureLoader().load(new URL(`./earth-${name}-${k}.webp`, import.meta.url).href, () => { if (--left === 0) ready = true; });
      tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = aniso; tex.wrapS = THREE.RepeatWrapping;
      EU[key].value = tex;
    };
    load('day', 'tDay'); load('night', 'tNight'); load('clouds', 'tClouds');
  }, { timeout: 2500 });
  let ready = false;

  /* ================= per frame ================= */
  const sunAlpha = track([[10, -10], [11, -48]]), sunLight = track([[10, 20], [11, 34]]), burstK = track([[10, 0.7], [11, 0.38]]);   // the sun stands just behind the limb: a lit crescent, the rest night
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
    glare.material.opacity = clamp(gain * 0.5);
    glare.visible = burst.visible = gain > 0.01;
  }

  function update3d(s, dt) {
    depth += (depthT - depth) * Math.min(1, dt * 3);
    EU.uLights.value = mix(1.1, 0.75, sstep(10, 11, s)) * (1 - 0.45 * depth);
    EU.uDay.value = 1 - 0.35 * depth;
    if (s > 10.3) bgSpin += dt * 0.032 * (reduce ? 0 : 1) * sstep(10.3, 11, s);
    earth.rotation.y = 3.5 + bgSpin + T.value * 0.004;
    if (ready && EU.uReady.value < 1) EU.uReady.value = Math.min(1, EU.uReady.value + dt * 1.5);
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
    ['tDay', 'tNight', 'tClouds'].forEach(k => EU[k].value && EU[k].value.dispose());
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
