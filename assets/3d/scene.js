/* Bergmann AI: the intro in front of the page, then the earth turning behind it.

   One timeline value S follows the scroll position:
     0 .. 10   the intro (film.js): the word "Bergmann AI", the turning earth seen through its letters;
               scrolling flies into the letters while the camera pulls back from the horizon to the hero
               picture, until the earth stands alone (S 8.6), then it holds briefly
     10 .. 11  the hero ("KI-Chatbots und Automatisierungen für Betriebe") comes up over the earth
     11        the page: the earth only turns in the background
   Scroll: GSAP ScrollTrigger (assets/vendor) reads it, gsap.quickTo smooths S; without GSAP a plain
   scroll listener and an own easing do the same. The globe behind the page gets a light bloom (bloom.js).
   Without WebGL a still of the globe (assets/img/hero-earth-1600.webp) stands in.
   Smoothness: every frame is drawn, in the GSAP ticker right after the tweens (no frame skipping, no
   one-frame lag); the canvas never changes size while scrolling (it is 100lvh, so a phone's address bar
   does not resize it); programs are compiled in parallel and render targets allocated ahead; the earth
   pictures are decoded off the main thread and uploaded in strips (gpu-upload.js); a governor lowers the
   globe's internal resolution step by step when frames come late. ?fps shows the frame rate. */
import * as THREE from './three.module.min.js';
import { createFilm, FLIGHT } from './film.js';
import { createBloom } from './bloom.js';
import { decode, canStream, stripUploader, compileAhead } from './gpu-upload.js';

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
  // the canvas gets the sharpest pixels the intro needs (one picture quad) and keeps them: no resize on
  // the way to the page. The globe behind the page is drawn at its own, lower resolution (bloom.js).
  const dev = window.devicePixelRatio || 1;
  const DPR = Math.min(dev, 2), BG_DPR = Math.min(dev, small ? 1.5 : 1.75);
  renderer.setPixelRatio(DPR);
  renderer.debug.checkShaderErrors = /[?&]debug\b/.test(location.search);   // the shaders are fixed; checking them costs a wait on the GPU
  renderer.setClearColor(0x02040b, 1);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // shaders write display values directly
  renderer.autoClear = false;
  // multisampling only where pixels are big enough to show stair steps (a desktop screen at 1x)
  const bloom = createBloom(renderer, small
    ? { levels: 3, scale: 0.34, msaa: 0, strength: 0.7, threshold: 0.6, sceneScale: BG_DPR / DPR }
    : { levels: 4, scale: 0.5, msaa: BG_DPR < 1.5 ? 4 : 0, strength: 0.85, threshold: 0.6, sceneScale: BG_DPR / DPR });
  const film = createFilm(renderer);
  film.warm();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 400);
  const D2R = Math.PI / 180;
  const T = { value: 0 };                   // time in seconds (frozen with reduced motion)
  const SUN = { value: new THREE.Vector3(1, 0.3, 0.2).normalize() };
  const EC = new THREE.Vector3(0, 0.1, 0);
  const rnd = rng(7);

  const starDpr = { value: BG_DPR };
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
      transparent: true, depthWrite: false, uniforms: { dpr: starDpr },
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
        vec2 uv=vec2(vUv.x,1.-vUv.y);   // the maps are stored top row first
        vec3 ground=pow(texture2D(tDay,uv).rgb,vec3(2.2));
        float ocean=smoothstep(.03,.12,ground.b-max(ground.r,ground.g));
        ground=mix(ground,ground*vec3(.28,.45,.7),ocean*.75);                    // open ocean is darker than the map
        float cl=smoothstep(.1,.9,texture2D(tClouds,uv+vec2(uTime*.0009,0.)).r);  // clouds drift slowly
        float sh=smoothstep(.1,.9,texture2D(tClouds,uv+vec2(uTime*.0009+.0025,-.0015)).r);
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
        vec3 lights=pow(max(texture2D(tNight,uv).rgb-vec3(.055,.06,.11),0.)*1.15,vec3(2.2));   // the lights only, without the map's blue ground
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
    K0 = aim({ az: -95, el: 10, d: L(2.4, 2.05), ox: L(2, 5), oy: L(-25.6, -28.5) });   // close: the lit limb and the sunrise run through the word, toward "AI"
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
  const HOLD = 0.4;   // the earth stands a moment before the page comes up
  let introTop = 0, introLen = 1, S = reduce ? 11 : 0, target = S, auto = reduce ? 1 : 0, bgSpin = 0, lastY = scrollY, depth = 0, depthT = 0;
  // the sticky view is 100svh: a stable height, unlike innerHeight while a phone's address bar moves
  const view = intro && intro.querySelector('.intro__view');
  let vh = innerHeight;
  function measure() {
    const on = intro && intro.offsetParent !== null && getComputedStyle(intro).display !== 'none';
    vh = (on && view && view.offsetHeight) || innerHeight;
    if (on) { introTop = intro.getBoundingClientRect().top + scrollY; introLen = Math.max(1, intro.offsetHeight - vh); }
    else { introTop = 0; introLen = 0; }
  }
  function readScroll() {
    if (reduce) { target = 11; return; }
    const y = scrollY;
    if (!introLen) target = 11;
    else {
      const f = (y - introTop) / introLen;
      target = f <= 1 ? clamp(f * (10 + HOLD), 0, 10) : 10 + clamp((y - introTop - introLen) / (vh * 0.8));
    }
    // below the hero the page is text: the earth steps back a little
    depthT = clamp((y - introTop - introLen - vh * 1.2) / vh);
    bgSpin += (y - lastY) * 0.00025 * sstep(FLIGHT[1] - 0.6, FLIGHT[1] + 0.8, S); lastY = y;
  }
  // GSAP ScrollTrigger reads the scroll (and re-measures on layout changes); quickTo smooths S
  const G = window.gsap, ST = window.ScrollTrigger, prox = { s: S };
  let sTo = null;
  if (G && ST && intro && !reduce) {
    G.registerPlugin(ST);
    sTo = G.quickTo(prox, 's', { duration: 0.85, ease: 'power3.out' });
    ST.create({ trigger: intro, start: 'top top', endTrigger: '#start', end: 'bottom top', onRefresh: () => { measure(); onScroll(); } });
  }
  function onScroll() {
    readScroll();
    if (!sTo) return;
    const d = target - prox.s;   // a jump (anchor link) plays at most 1.6 scenes
    if (Math.abs(d) > 1.6) sTo(target, target - Math.sign(d) * 1.6); else sTo(target);
  }
  addEventListener('scroll', onScroll, { passive: true });

  // sized by the canvas box (100vw x 100lvh): a phone's address bar showing or hiding changes innerHeight,
  // not the canvas, so nothing is reallocated while scrolling
  let cw = 0, ch = 0;
  // the globe with its bloom, drawn into this while the word lies over it
  const live = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const buf = new THREE.Vector2();
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    if (w !== cw || h !== ch) {
      cw = w; ch = h;
      renderer.setSize(w, h, false); bloom.setSize();
      renderer.getDrawingBufferSize(buf); live.setSize(buf.x, buf.y);
      if (warmed) { bloom.warm().catch(() => {}); renderer.initRenderTarget(live); }
      aspect = w / h; fovV = mix(58, 38, sstep(0.6, 1.4, aspect));
      camera.aspect = aspect; camera.fov = fovV; camera.updateProjectionMatrix();
      // the film fills the screen under the opaque header
      const top = nav ? Math.min(nav.offsetHeight, h * 0.2) : 0;
      film.use(aspect < 0.95 ? 'two' : 'one');
      film.setAspect(w / (h - top), top / h);
      evalShots();
    }
    measure(); readScroll();
  }
  let warmed = false;
  addEventListener('resize', resize);
  resize();
  S = prox.s = target;

  // ahead of the hand-over: compile every program in parallel and allocate the render targets, so the
  // first frame of the globe does not stall
  const idle = window.requestIdleCallback || (f => setTimeout(f, 400));
  // a program's first use reads back its uniforms and attributes (a wait on the GPU): done here as well
  const firstUse = list => list.forEach(m => { const p = renderer.properties.get(m).currentProgram; if (p) { p.getUniforms(); p.getAttributes(); } });
  const mats = o => { const m = []; o.traverse(x => { if (x.material) m.push(x.material); }); return m; };
  idle(() => {
    update3d(10.6, 0);
    compileAhead(renderer, scene, camera).then(() => {
      firstUse(mats(scene));
      // a dress rehearsal into a 4 x 4 target uploads the geometry and binds everything once
      const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
      renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null); rt.dispose();
    }).catch(() => {});
    bloom.warm().then(() => firstUse(bloom.materials)).catch(() => {});
    renderer.initRenderTarget(live);
    warmed = true;
  }, { timeout: 1500 });
  // the earth pictures: seen through the letters from the start, so loaded at once, decoded off the main
  // thread and uploaded a strip per frame (see frame()); until then the letters show their glass alone
  const uploads = [], earthTex = [];
  const maps = [['day', 'tDay'], ['night', 'tNight'], ['clouds', 'tClouds']];
  const mapUrl = n => new URL(`./earth-${n}-${small ? '2k' : '4k'}.webp`, import.meta.url).href;
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  let ready = false, readyAt = 0;
  const isReady = () => { ready = true; readyAt = performance.now(); };
  // older browsers, or when streaming fails: one upload per map, done as soon as it is loaded rather
  // than on the first globe frame
  function viaLoader() {
    uploads.forEach(u => u.dispose()); uploads.length = 0;
    let left = maps.length;
    maps.forEach(([n, key]) => {
      const tex = new THREE.TextureLoader().load(mapUrl(n), () => { renderer.initTexture(tex); if (--left === 0) isReady(); });
      tex.colorSpace = THREE.NoColorSpace; tex.flipY = false; tex.anisotropy = aniso; tex.wrapS = THREE.RepeatWrapping;
      EU[key].value = tex; earthTex.push(tex);
    });
  }
  if (!canStream) viaLoader();
  else Promise.all(maps.map(([n]) => decode(mapUrl(n)))).then(bitmaps => {
    bitmaps.forEach((b, i) => { const up = stripUploader(renderer, b, { rows: small ? 128 : 96, repeatS: true, aniso }); EU[maps[i][1]].value = up.texture; uploads.push(up); earthTex.push(up); });
  }, viaLoader);

  /* ================= per frame ================= */
  // over the flight (0..1): the sun stands just behind the limb, a lit crescent, the rest night
  const sunLight = track([[0, 20], [1, 34]]), burstK = track([[0, 0.7], [1, 0.38]]);
  const sunAlpha = g => mix(L(-6, -24), -48, sstep(0, 1, g));   // phones: the sunrise sits between "Bergmann" and "AI"
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
    burst.material.opacity = clamp(gain) * EU.uReady.value;
    sdir.copy(v).multiplyScalar(Math.cos(th + 0.035)).addScaledVector(w, Math.sin(th + 0.035));
    glare.position.copy(camera.position).addScaledVector(sdir, 80);
    glare.scale.setScalar(80 * 0.45);
    glare.material.opacity = clamp(gain * 0.5) * EU.uReady.value;
    glare.visible = burst.visible = gain > 0.01;
  }

  function update3d(s, dt) {
    const g = film.progress(s);   // the camera follows the flight: from the horizon back to the hero picture
    depth += (depthT - depth) * Math.min(1, dt * 3);
    EU.uLights.value = mix(1.1, 0.75, g) * (1 - 0.45 * depth);
    EU.uDay.value = 1 - 0.35 * depth;
    bgSpin += dt * 0.032 * (reduce ? 0 : 1);   // the earth turns all the time
    earth.rotation.y = 3.5 + bgSpin + T.value * 0.004;
    EU.uReady.value = readyAt ? sstep(0, 700, performance.now() - readyAt) : 0;   // fades in over real time once the maps are up
    shotAt(g);
    camera.position.copy(camPos); camera.up.copy(camU); camera.lookAt(look.copy(camPos).add(camF));
    camera.updateMatrixWorld();
    sky.position.copy(camera.position);
    sun(sunAlpha(g), sunLight(g), burstK(g) * (1 - 0.5 * depth));
  }

  /* ================= frame-time governor: the globe's resolution follows what the GPU manages =================
     The display's frame time is what frames take when they come in time (a low percentile of recent
     intervals; 60 Hz at most). When the median runs clearly above it while the globe is drawn, the
     globe's internal resolution steps down; after a calm stretch it tries one step up again. */
  const gov = { hist: [], last: 0, down: 0, min: small ? 0.6 : 0.55, off: /[?&]gov=0\b/.test(location.search) };   // ?gov=0: fixed resolution, for measuring
  function governor(now, ms) {
    if (reduce || gov.off) { gov.hist.length = 0; return; }
    gov.hist.push(ms); if (gov.hist.length > 90) gov.hist.shift();
    if (gov.hist.length < 45 || now - gov.last < 1500) return;
    const h = gov.hist.slice().sort((a, b) => a - b);
    const vsync = clamp(h[Math.floor(h.length * 0.15)], 6.9, 16.9), med = h[h.length >> 1];
    let q = bloom.quality;
    if (med > vsync * 1.3 && q > gov.min) { q = Math.max(gov.min, q * 0.85); gov.down = now; }
    else if (med < vsync * 1.08 && q < 1 && now - gov.down > 8000) q = Math.min(1, q / 0.85);
    else return;
    bloom.setQuality(q); starDpr.value = bloom.pixelRatio;
    gov.last = now; gov.hist.length = 0;
  }

  /* ================= ?fps: frame rate overlay for checking on a real device ================= */
  const meter = /[?&]fps\b/.test(location.search) ? (() => {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:8px;top:84px;z-index:9999;padding:6px 9px;border-radius:8px;background:rgb(0 0 0 / .72);color:#8fe3ff;font:12px/1.35 ui-monospace,Menlo,monospace;pointer-events:none;white-space:pre';
    document.body.append(el);
    const ms = []; let t0 = performance.now(), n = 0;
    return now => {
      n++; ms.push(now - (ms.t || now)); ms.t = now; if (ms.length > 240) ms.shift();
      if (now - t0 < 500) return;
      const h = ms.slice(1).sort((a, b) => a - b), p = f => (h[Math.floor(h.length * f)] || 0).toFixed(1);
      el.textContent = `${Math.round(n * 1000 / (now - t0))} fps\n${p(0.5)} ms · p95 ${p(0.95)} ms\nErde ${Math.round(bloom.pixelRatio * 100) / 100}x`;
      t0 = now; n = 0;
    };
  })() : null;

  let visible = !document.hidden, last = performance.now(), born = 0, frames = 0;
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible) last = performance.now(); });
  function frame(now) {
    if (!visible) return;
    const ms = now - last;
    const dt = Math.min(0.05, ms / 1000); last = now;
    if (meter) meter(now);
    governor(now, ms);
    // the earth pictures go up a strip per frame, one picture after the other
    if (uploads.length && uploads[0].step()) { uploads.shift(); if (!uploads.length) isReady(); }
    else if (uploads.length && uploads[0].failed) viaLoader();
    if (!reduce) T.value += dt;
    if (!born && film.ready) born = now;   // the word arrives once it is loaded
    auto = reduce ? 1 : born ? sstep(80, 1900, now - born) : 0;
    if (sTo) S = prox.s;
    else {
      if (Math.abs(target - S) > 1.6) S = target - Math.sign(target - S) * 1.6;   // a jump (anchor link) plays at most 1.6 scenes
      S += (target - S) * (reduce ? 1 : 1 - Math.pow(0.006, dt));
      if (Math.abs(target - S) < 1e-4) S = target;
    }
    // every frame is drawn: the globe turns and follows the scroll at the display's full rate. While
    // the word shows, the globe goes into a texture first and the word is laid over it.
    if (S < FLIGHT[1] && !film.ready && !reduce) { syncUi(); return; }   // the word comes first
    update3d(S, dt);
    if (film.ready && !reduce && film.showing(S, auto)) {
      bloom.render(scene, camera, live);
      renderer.setRenderTarget(null); renderer.clear();
      film.render(S, auto, T.value, live.texture, bloom.glow, live.width, live.height);
    } else {
      renderer.setRenderTarget(null); renderer.clear();
      bloom.render(scene, camera, null);
    }
    if (++frames === 2) canvas.classList.add('is-ready');
    syncUi();
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
  // driven by the GSAP ticker when it is there: S (quickTo) is updated first, then drawn, in the same frame
  if (G) G.ticker.add(() => frame(performance.now()));
  else { const loop = t => { frame(t); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
  renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); fail(); });
  // free the GPU when the page goes away (kept when it is only parked for back/forward)
  addEventListener('pagehide', e => {
    if (e.persisted) return;
    visible = false;
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => { if (x.map) x.map.dispose(); x.dispose(); }); });
    earthTex.forEach(t => t.dispose());
    film.dispose(); bloom.dispose(); live.dispose(); renderer.dispose();
  });
  window.__scene = {
    get S() { return S; }, get target() { return target; }, get ready() { return ready; }, get uploading() { return uploads.length; }, get quality() { return bloom.quality; }, get fadeIn() { return EU.uReady.value; },
    set: s => { target = S = prox.s = s; if (sTo) sTo(s, s); },
    snap: () => { readScroll(); S = prox.s = target; if (sTo) sTo(target, target); }
  };
}

// no-3d steht schon, wenn die Prüfung im <head> kein WebGL2 fand: dann gar nicht erst versuchen
if (!root.classList.contains('no-3d')) {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  } catch (e) { fail(); }
}
if (renderer) { try { start(); } catch (e) { console.error(e); fail(); } }
