/* Bergmann AI: 3D earth behind the page. The camera flies along a path that follows the scroll position. */
import * as THREE from './three.module.min.js';

const canvas = document.getElementById('earth3d');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = matchMedia('(max-width: 700px)').matches;

function fail() { document.documentElement.classList.add('no-3d'); }

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, alpha: false, powerPreference: 'high-performance' });
} catch (e) { fail(); }

if (renderer) start();

function start() {
  const DPR = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75);
  renderer.setPixelRatio(DPR);
  renderer.setClearColor(0x02040b, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 200);

  const D2R = Math.PI / 180;
  // lon/lat (degrees) -> point on a sphere of radius r, matching the equirectangular texture
  const ll = (lon, lat, r = 1) => {
    const phi = (90 - lat) * D2R, th = (lon + 180) * D2R;
    return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
  };

  // the sun sits just beyond the horizon the start camera looks at, a little to the right: a sunrise at the limb
  const sunDir = (() => { const C = ll(6, 30, 1.62), L = ll(-32, 62, 0.86), up = C.clone().normalize(), f = L.sub(C).normalize();
    return f.applyAxisAngle(up, -0.42).addScaledVector(up, 0.10).normalize(); })();

  /* ---------- earth ---------- */
  const tex = new THREE.TextureLoader().load(new URL(small ? './earth-2k.webp' : './earth-4k.webp', import.meta.url).href, () => { canvas.classList.add('is-ready'); });
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const earthMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, sunDir: { value: sunDir }, uTime: { value: 0 }, uDim: { value: 1 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 sunDir; uniform float uTime; uniform float uDim; varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){
        vec3 t=texture2D(map,vUv).rgb; float land=t.r; float lights=pow(t.g,1.7)*1.25;
        vec3 N=normalize(vN); vec3 V=normalize(cameraPosition-vW);
        float ndl=dot(N,sunDir); float day=smoothstep(-.12,.35,ndl); float night=1.-smoothstep(-.25,.05,ndl);
        vec3 nightCol=mix(vec3(.006,.016,.05),vec3(.018,.042,.11),land);
        vec3 dayCol=mix(vec3(.02,.09,.36),vec3(.07,.17,.42),land)*(.3+.8*max(ndl,0.));
        vec3 col=mix(nightCol,dayCol,day);
        float tw=.88+.12*sin(uTime*1.7+vUv.x*900.+vUv.y*700.);
        col+=vec3(1.,.80,.52)*lights*night*1.5*tw*uDim;
        float fr=pow(1.-max(dot(N,V),0.),3.2);
        col+=vec3(.16,.40,1.)*fr*(.30+.85*smoothstep(-.5,.4,ndl));
        float term=smoothstep(-.18,.02,ndl)*(1.-smoothstep(.02,.3,ndl));
        col+=vec3(.25,.5,1.)*term*.22;
        gl_FragColor=vec4(col,1.);
      }`
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, small ? 96 : 160, small ? 64 : 100), earthMat);
  scene.add(earth);

  // atmosphere halo
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.12, 96, 64), new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: sunDir } }, side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 sunDir; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 V=normalize(cameraPosition-vW); vec3 N=normalize(vN);
        float rim=pow(clamp(abs(dot(N,V))/.45,0.,1.),2.2);
        float lit=.22+1.15*smoothstep(-.6,.5,dot(N,sunDir));
        gl_FragColor=vec4(vec3(.25,.55,1.)*rim*lit*1.35,rim*lit); }`
  }));
  scene.add(atmo);

  /* ---------- sun glare at the limb ---------- */
  const glare = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.06, 'rgba(225,240,255,.95)'); r.addColorStop(.22, 'rgba(110,165,255,.45)'); r.addColorStop(.55, 'rgba(50,100,255,.12)'); r.addColorStop(1, 'rgba(30,70,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 256, 256);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.position.copy(sunDir).multiplyScalar(60); s.scale.setScalar(34); return s;
  })();
  scene.add(glare);

  /* ---------- stars ---------- */
  {
    const n = small ? 1400 : 2600, pos = new Float32Array(n * 3), sz = new Float32Array(n); let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) { const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u), R = 90; pos[i * 3] = R * s * Math.cos(a); pos[i * 3 + 1] = R * u; pos[i * 3 + 2] = R * s * Math.sin(a); sz[i] = rnd() < .08 ? 2.6 : .8 + rnd() * 1.2; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
    scene.add(new THREE.Points(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { dpr: { value: DPR } },
      vertexShader: `attribute float aSize; uniform float dpr; varying float vS; void main(){ vS=aSize; gl_PointSize=aSize*dpr; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `varying float vS; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.05,d); gl_FragColor=vec4(.82,.9,1.,a*(.35+.25*vS)); }` })));
  }

  /* ---------- light routes between cities ---------- */
  const routeMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 } },
    vertexShader: `attribute float aT; attribute float aO; varying float vT; varying float vO; void main(){ vT=aT; vO=aO; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uTime; varying float vT; varying float vO;
      void main(){ float p=fract(uTime*.11+vO); float d=vT-p; float head=smoothstep(.0,.012,d+.012)*(1.-smoothstep(.0,.012,d)); float tail=smoothstep(-.28,0.,d)*step(d,0.);
        float fade=sin(vT*3.14159); gl_FragColor=vec4(vec3(.56,.89,1.)*(.10+tail*.75+head*2.2)*fade,1.); }` });
  {
    const C = { hal: [8.36, 52.06], ber: [13.4, 52.52], par: [2.35, 48.86], lon: [-0.13, 51.5], mad: [-3.7, 40.4], rom: [12.5, 41.9], ist: [28.97, 41.0], mos: [37.6, 55.75], cai: [31.2, 30.0], dub: [55.3, 25.2], nyc: [-74, 40.7], sto: [18.07, 59.33], war: [21, 52.2], vie: [16.37, 48.2], lis: [-9.14, 38.72], del: [77.2, 28.6], lag: [3.4, 6.5] };
    const pairs = [['hal', 'ber'], ['hal', 'par'], ['hal', 'lon'], ['hal', 'vie'], ['hal', 'sto'], ['hal', 'rom'], ['hal', 'mad'], ['ber', 'war'], ['war', 'mos'], ['vie', 'ist'], ['ist', 'dub'], ['rom', 'cai'], ['lon', 'nyc'], ['par', 'lis'], ['dub', 'del'], ['mad', 'lag'], ['mos', 'del'], ['cai', 'dub']];
    const pos = [], aT = [], aO = [], idx = []; let base = 0;
    pairs.forEach(([a, b], k) => {
      const A = ll(...C[a]), B = ll(...C[b]), ang = A.angleTo(B), N = 64, h = .02 + ang * .16;
      for (let i = 0; i <= N; i++) { const t = i / N; const p = A.clone().lerp(B, t).normalize().multiplyScalar(1.004 + Math.sin(t * Math.PI) * h); pos.push(p.x, p.y, p.z); aT.push(t); aO.push((k * .37) % 1); if (i < N) idx.push(base + i, base + i + 1); }
      base += N + 1;
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1)); g.setAttribute('aO', new THREE.Float32BufferAttribute(aO, 1)); g.setIndex(idx);
    scene.add(new THREE.LineSegments(g, routeMat));
  }

  /* ---------- camera path: [scroll 0..1, cam lon, cam lat, cam distance, look lon, look lat, look radius] ---------- */
  const KEYS = [
    [0.00, 6, 30, 1.62, -32, 62, 0.86],   // start: low over Europe, horizon and sunrise ahead
    [0.14, 10, 40, 1.38, -20, 66, 0.90],  // dive toward the lights
    [0.34, 22, 47, 1.30, 8, 60, 0.94],    // flight over central Europe
    [0.56, 48, 40, 1.52, 22, 50, 0.80],   // drift east, climb
    [0.78, 30, 26, 2.25, 14, 44, 0.35],   // pull back, the globe appears
    [1.00, 4, 18, 3.05, 8, 44, 0.0]       // end: whole earth with the sunrise
  ];
  const ease = t => t * t * (3 - 2 * t);
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tPos = new THREE.Vector3(), tLook = new THREE.Vector3();
  function path(p, outP, outL) {
    let i = 0; while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++;
    const a = KEYS[i], b = KEYS[i + 1], t = ease(Math.min(1, Math.max(0, (p - a[0]) / (b[0] - a[0])))), m = k => a[k] + (b[k] - a[k]) * t;
    outP.copy(ll(m(1), m(2), m(3))); outL.copy(ll(m(4), m(5), m(6)));
  }
  let progress = 0;
  const readScroll = () => { const max = document.documentElement.scrollHeight - innerHeight; progress = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0; };
  addEventListener('scroll', readScroll, { passive: true });

  function resize() {
    const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.fov = w / h < .8 ? 58 : 42; camera.updateProjectionMatrix(); readScroll();
  }
  addEventListener('resize', resize); resize();
  path(progress, camPos, camLook);

  let visible = true, last = performance.now(), time = 0;
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible) { last = performance.now(); requestAnimationFrame(frame); } });
  function frame(now) {
    if (!visible) return;
    const dt = Math.min(.05, (now - last) / 1000); last = now; if (!reduce) time += dt;
    path(progress, tPos, tLook);
    const k = reduce ? 1 : 1 - Math.pow(.0015, dt);   // smooth follow, frame-rate independent
    camPos.lerp(tPos, k); camLook.lerp(tLook, k);
    camera.position.copy(camPos); camera.up.copy(camPos).normalize(); camera.lookAt(camLook);
    earthMat.uniforms.uTime.value = time; routeMat.uniforms.uTime.value = time;
    const pr = progress; earthMat.uniforms.uDim.value += ((pr < .06 || pr > .9 ? 1 : .5) - earthMat.uniforms.uDim.value) * Math.min(1, dt * 3);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); fail(); });
  window.__earth = { KEYS, set: p => { progress = p; } };
}
