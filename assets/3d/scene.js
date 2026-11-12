/* Bergmann AI: the scroll film in front of the page, then the earth turning behind it.

   One timeline value S drives camera, light, particles and objects together:
     0 .. 10   the ten storyboard scenes, played by scrolling through #intro
               1 brain appears, 2 brain activates, 3 it breaks into particles, 4 the particles form a sphere,
               5 the earth appears, 6 the earth turns, 7 camera flight, 8 the horizon, 9 AI forms, 10 end frame
     10 .. 11  hand-over to the page: the AI stage fades, the camera pulls back to the globe
     11        the page: the earth only turns in the background
   The storyboard frames are references, not clips. Scene 10 rebuilds the original AI picture
   (assets/img/hero-ai-1600.webp), which is also the still shown without WebGL. */
import * as THREE from './three.module.min.js';

const canvas = document.getElementById('earth3d');
const intro = document.getElementById('intro');
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = matchMedia('(max-width: 700px), (pointer: coarse)').matches;

function fail() {
  if (root.classList.contains('no-3d')) return;
  const y = scrollY, h = intro && intro.offsetParent ? intro.offsetHeight : 0;
  root.classList.add('no-3d');
  if (h && y > 0) scrollTo(0, Math.max(0, y - h));
}

let renderer;

/* ---------- small helpers ---------- */
function clamp(x, a = 0, b = 1) { return Math.min(b, Math.max(a, x)); }
function sstep(a, b, x) { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); }
function mix(a, b, t) { return a + (b - a) * t; }
function band(x, a, b, c, d) { return sstep(a, b, x) * (1 - sstep(c, d, x)); }
function track(pts) { // [[S, value], ...] eased between the keys
  return s => {
    if (s <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (s <= pts[i][0]) return mix(pts[i - 1][1], pts[i][1], sstep(pts[i - 1][0], pts[i][0], s));
    return pts[pts.length - 1][1];
  };
}
function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// 3D simplex noise (S. Gustavson), seeded
function makeNoise(seed) {
  const G = [1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1];
  const r = rng(seed), p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)), t = p[i]; p[i] = p[j]; p[j] = t; }
  const perm = new Uint8Array(512), m12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; m12[i] = perm[i] % 12; }
  const F3 = 1 / 3, G3 = 1 / 6;
  return (x, y, z) => {
    const s = (x + y + z) * F3, i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
    const t = (i + j + k) * G3, x0 = x - i + t, y0 = y - j + t, z0 = z - k + t;
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; } else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; } else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; } else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    const c = (gi, a, b, d) => { let tt = 0.6 - a * a - b * b - d * d; if (tt < 0) return 0; tt *= tt; return tt * tt * (G[gi] * a + G[gi + 1] * b + G[gi + 2] * d); };
    return 32 * (c(m12[ii + perm[jj + perm[kk]]] * 3, x0, y0, z0) + c(m12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3, x1, y1, z1) +
      c(m12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3, x2, y2, z2) + c(m12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3, x3, y3, z3));
  };
}

// a sphere without poles: six spherified cube faces, shared vertices merged (smooth normals, no seams)
function cubeSphere(N) {
  const pos = [], idx = [], map = new Map(), v = [0, 0, 0];
  for (const [a, b, c] of [[0, 1, 2], [1, 2, 0], [2, 0, 1]]) for (const s of [1, -1]) {
    const ids = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      v[a] = s; v[b] = i / N * 2 - 1; v[c] = (j / N * 2 - 1) * s;
      const [x, y, z] = v, x2 = x * x, y2 = y * y, z2 = z * z;
      const px = x * Math.sqrt(1 - y2 / 2 - z2 / 2 + y2 * z2 / 3), py = y * Math.sqrt(1 - z2 / 2 - x2 / 2 + z2 * x2 / 3), pz = z * Math.sqrt(1 - x2 / 2 - y2 / 2 + x2 * y2 / 3);
      const key = Math.round(px * 1e5) + ',' + Math.round(py * 1e5) + ',' + Math.round(pz * 1e5);
      let id = map.get(key);
      if (id === undefined) { id = pos.length / 3; pos.push(px, py, pz); map.set(key, id); }
      ids.push(id);
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const q0 = ids[j * (N + 1) + i], q1 = ids[j * (N + 1) + i + 1], q2 = ids[(j + 1) * (N + 1) + i], q3 = ids[(j + 1) * (N + 1) + i + 1];
      idx.push(q0, q1, q3, q0, q3, q2);
    }
  }
  return { pos, idx };
}

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

// world-space varyings shared by most materials
const VS_WORLD = `varying vec3 vN; varying vec3 vW; varying vec3 vL; varying vec3 vLN; varying vec2 vUv;
void main(){ vUv=uv; vL=position; vLN=normal; vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;

const ADD = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };

function start() {
  const DPR = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75);
  renderer.setPixelRatio(DPR);
  renderer.setClearColor(0x02040b, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.004, 400);
  const D2R = Math.PI / 180;
  const T = { value: 0 };                   // time in seconds (frozen with reduced motion)
  const PROJ = { value: 800 };              // pixels per world unit at distance 1, for point sizes
  const SUN = { value: new THREE.Vector3(1, 0.3, 0.2).normalize() };
  const EC = new THREE.Vector3(0, 0.1, 0);  // the earth (and the brain before it) sits here
  const rnd = rng(7);

  /* ================= sky: nebula and stars ================= */
  const sky = new THREE.Group(); scene.add(sky);
  const skyGain = { value: 1 };
  {
    const m = new THREE.Mesh(new THREE.SphereGeometry(160, 48, 32), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, uniforms: { uGain: skyGain },
      vertexShader: `varying vec3 vD; void main(){ vD=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `${NOISE} uniform float uGain; varying vec3 vD;
        void main(){ vec3 d=normalize(vD);
          float n=snoise(d*1.7)*.5+snoise(d*3.6+7.)*.3+snoise(d*7.4+3.)*.2;
          float neb=smoothstep(.0,.8,n);
          float band=exp(-pow(dot(d,normalize(vec3(.42,1.,.3)))*2.6,2.));
          float low=smoothstep(.15,-.6,d.y);
          float m=neb*(.25+.55*band+.45*low);
          vec3 col=vec3(.006,.012,.034)+vec3(.02,.045,.12)*m+vec3(.025,.02,.07)*neb*band*.5;
          gl_FragColor=vec4(col*uGain,1.); }`
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
      transparent: true, depthWrite: false, uniforms: { dpr: { value: DPR }, uTime: T, uGain: skyGain },
      vertexShader: `attribute float aSize; uniform float dpr, uTime; varying float vS; varying float vT;
        void main(){ vS=aSize; vT=.75+.25*sin(uTime*1.3+position.x*.7+position.y); gl_PointSize=aSize*dpr; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform float uGain; varying float vS; varying float vT; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.05,d); gl_FragColor=vec4(.82,.9,1.,a*(.32+.25*vS)*vT*uGain); }`
    }));
    st.renderOrder = -9; sky.add(st);
  }

  /* ================= reusable glowing pieces ================= */
  function ringMat(gainU, color, intensity, arcs = 0, spin = 0) {
    return new THREE.ShaderMaterial({
      ...ADD, uniforms: { uGain: gainU, uTime: T, uC: { value: new THREE.Color(color) }, uI: { value: intensity }, uArcs: { value: arcs }, uSpin: { value: spin } },
      vertexShader: VS_WORLD,
      fragmentShader: `uniform float uGain, uTime, uI, uArcs, uSpin; uniform vec3 uC; varying vec3 vN; varying vec3 vW; varying vec2 vUv;
        void main(){ vec3 V=normalize(cameraPosition-vW); float f=abs(dot(normalize(vN),V));
          float on=1.; if(uArcs>0.){ float a=fract(vUv.x*uArcs+uTime*uSpin); on=smoothstep(0.,.03,a)*(1.-smoothstep(.5,.56,a)); }
          gl_FragColor=vec4(uC*uI*uGain*on*(.4+.6*f),1.); }`
    });
  }
  // a thin glowing ring lying flat (in the x-z plane)
  function flatRing(r, y, tube, mat) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, Math.min(360, Math.round(120 + r * 120))), mat);
    m.rotation.x = Math.PI / 2; m.position.y = y; return m;
  }
  // an orbit: a tilted ring with a bright comet running along it
  function makeOrbit(r, tube, gainU, speed, phase, color = 0x8fd0ff) {
    const g = new THREE.Group();
    const mk = (tb, k, glow) => new THREE.Mesh(new THREE.TorusGeometry(r, tb, 8, 360), new THREE.ShaderMaterial({
      ...ADD, uniforms: { uGain: gainU, uTime: T, uSp: { value: speed }, uPh: { value: phase }, uC: { value: new THREE.Color(color) }, uK: { value: k } },
      vertexShader: VS_WORLD,
      fragmentShader: `uniform float uGain, uTime, uSp, uPh, uK; uniform vec3 uC; varying vec3 vN; varying vec3 vW; varying vec2 vUv;
        void main(){ vec3 V=normalize(cameraPosition-vW); float f=abs(dot(normalize(vN),V));
          float d=fract(fract(uTime*uSp+uPh)-vUv.x);
          float b=.16+1.5*exp(-d*7.)+4.*exp(-d*140.);
          gl_FragColor=vec4(uC*b*uK*uGain*pow(f,${glow ? '2.' : '.5'}),1.); }`
    }));
    g.add(mk(tube, 1, false), mk(tube * 5, 0.22, true));
    return g;
  }

  /* ================= hologram pedestal ================= */
  function makePedestal(r, gainU, rings, order = 0) {
    const g = new THREE.Group();
    const metal = new THREE.ShaderMaterial({
      transparent: true, uniforms: { uGain: gainU, uR: { value: r } },
      vertexShader: VS_WORLD,
      fragmentShader: `uniform float uGain, uR; varying vec3 vN; varying vec3 vW; varying vec3 vL; varying vec3 vLN;
        void main(){ vec3 N=normalize(vN); vec3 V=normalize(cameraPosition-vW); float fr=pow(1.-abs(dot(N,V)),3.);
          vec3 col=vec3(.012,.022,.05)+vec3(.12,.3,.75)*fr*.7;
          float top=step(.5,vLN.y); float rr=length(vL.xz)/uR;
          col+=top*(vec3(.04,.12,.34)*(1.-rr)*.8+vec3(.01,.025,.06)*(.5+.5*sin(rr*90.))+vec3(.25,.55,1.)*smoothstep(.55,.6,rr)*(1.-smoothstep(.6,.64,rr))*.3);
          col+=(1.-top)*vec3(.08,.2,.5)*smoothstep(-.5,.5,vL.y/(uR*.08))*.25;
          gl_FragColor=vec4(col,uGain); }`
    });
    const rimHi = ringMat(gainU, 0x9fdcff, 1.6), rimLo = ringMat(gainU, 0x5aa8ff, 0.7);
    let y = 0;
    for (const [k, h0] of [[1, 0.075], [0.82, 0.06], [0.64, 0.05]]) {
      const rr = r * k, h = h0 * r;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr * 1.015, h, 128, 1), metal);
      m.position.y = y + h / 2; m.renderOrder = order; g.add(m);
      g.add(flatRing(rr * 1.002, y + h, 0.0034 * r, rimHi), flatRing(rr * 1.017, y + 0.002 * r, 0.0028 * r, rimLo));
      y += h;
    }
    // light on the top plate
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r * 0.64, 96), new THREE.ShaderMaterial({
      ...ADD, uniforms: { uGain: gainU, uTime: T },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform float uGain, uTime; varying vec2 vUv; void main(){ float d=length(vUv-.5)*2.;
        float c=exp(-d*d*5.)*.7+smoothstep(.62,.66,d)*(1.-smoothstep(.66,.7,d))*.6+smoothstep(.92,.97,d)*(1.-smoothstep(.97,1.,d))*.5;
        c*=.85+.15*sin(uTime*2.+d*9.); gl_FragColor=vec4(vec3(.3,.6,1.)*c*uGain,1.); }`
    }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = y + 0.002 * r; g.add(disc);
    for (const [k, arcs, spin, I] of rings) g.add(flatRing(r * k, 0.002 * r, 0.0026 * r, ringMat(gainU, 0x7cc4ff, I, arcs, spin)));
    if (order) g.children.forEach(c => { if (c.renderOrder === 0) c.renderOrder = order + 1; });
    g.userData.top = y;
    return g;
  }

  /* ================= the brain ================= */
  const nzA = makeNoise(11), nzB = makeNoise(23), nzC = makeNoise(37), nzD = makeNoise(51);
  const P = { x: 0, y: 0, z: 0, f: 0 };
  function cerebrum(dx, dy, dz, o) {
    const lat = Math.abs(dz);
    let x = dx * 1.02, z = dz * 0.8, y;
    if (dy >= 0) y = dy * 0.76;
    else y = dy * mix(0.36, 0.6, sstep(-0.85, -0.45, dx) * (1 - sstep(0.3, 0.9, dx)) * mix(0.3, 1, sstep(0.12, 0.55, lat)));
    z *= 0.88 + 0.14 * sstep(-0.9, 0.4, dx);
    y -= 0.07 * sstep(0.45, 1, dx) * (1 - 0.5 * Math.max(dy, 0));
    const fis = Math.exp(-((z / 0.055) ** 2)) * sstep(-0.3, 0.2, dy);
    let syl = 0;
    if (lat > 0.2) {
      const ax = -0.52, ay = -0.1, vx = 0.84, vy = 0.24;
      const t = clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy));
      syl = Math.exp(-((Math.hypot(x - ax - vx * t, y - ay - vy * t) / 0.045) ** 2)) * sstep(0.2, 0.55, lat) * (1 - sstep(0.8, 1, t));
    }
    // sulci where a warped noise field crosses zero: meandering grooves, gyri a little longer than wide
    const s = 1.5, w = 0.34, f = 3.3;
    const qx = x * f + nzB(x * s, y * s, z * s) * w, qy = y * f * 0.72 + nzB(x * s + 5.2, y * s + 1.3, z * s) * w, qz = z * f + nzB(x * s + 2.7, y * s + 9.1, z * s) * w;
    const n = nzA(qx, qy, qz) + 0.3 * nzC(qx * 2.1 + 4.1, qy * 2.1, qz * 2.1);
    const fold = Math.abs(n);
    const disp = -0.05 * (1 - Math.sqrt(sstep(0, 0.4, fold))) - 0.12 * fis - 0.07 * syl;
    const k = 1 + disp / Math.hypot(x, y, z);
    o.x = x * k; o.y = y * k; o.z = z * k; o.f = fold * (1 - fis) * (1 - syl);
  }
  function cerebellum(dx, dy, dz, o) {
    let x = dx * 0.34, y = dy * 0.23, z = dz * 0.56;
    if (y > 0) y *= 0.7;
    const ca = Math.cos(-0.35), sa = Math.sin(-0.35), rx = x * ca - y * sa, ry = x * sa + y * ca; x = rx; y = ry;
    const fol = Math.abs(Math.sin(Math.hypot(x + 0.32, y - 0.02) * 62 + nzC(x * 5, y * 5, z * 5) * 1.6));
    const verm = Math.exp(-((z / 0.05) ** 2));
    const k = 1 + (-0.016 * (1 - Math.sqrt(fol)) - 0.05 * verm) / Math.hypot(x, y, z);
    o.x = 0.56 + x * k; o.y = -0.43 + y * k; o.z = z * k; o.f = fol * (1 - verm);
  }
  function stem(u, t, o) { // u: angle, t: 0 bottom .. 1 top
    const r = mix(0.055, 0.1, t * t), cx = mix(0.1, 0.18, t), cy = mix(-1.22, -0.32, t);
    o.x = cx + Math.cos(u) * r; o.y = cy; o.z = Math.sin(u) * r; o.f = 0.35 + 0.3 * Math.abs(Math.sin(u * 6));
    return [Math.cos(u), 0, Math.sin(u)];
  }
  // appear key (a scan rising from the pedestal) and dissolve key (a front running from the back to the front)
  const keyA = (x, y, z) => y + 0.09 * nzD(x * 4, y * 4, z * 4);
  const keyD = (x, y, z) => x + 0.2 * nzD(x * 3 + 9, y * 3, z * 3);

  function brainSurface(N, fn) {
    const cs = cubeSphere(N), n = cs.pos.length / 3;
    const pos = new Float32Array(n * 3), fold = new Float32Array(n), ka = new Float32Array(n), kd = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      fn(cs.pos[i * 3], cs.pos[i * 3 + 1], cs.pos[i * 3 + 2], P);
      pos[i * 3] = P.x; pos[i * 3 + 1] = P.y; pos[i * 3 + 2] = P.z; fold[i] = P.f; ka[i] = keyA(P.x, P.y, P.z); kd[i] = keyD(P.x, P.y, P.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(cs.idx); g.computeVertexNormals();
    g.setAttribute('aFold', new THREE.BufferAttribute(fold, 1)); g.setAttribute('aKa', new THREE.BufferAttribute(ka, 1)); g.setAttribute('aKd', new THREE.BufferAttribute(kd, 1));
    return g;
  }
  function stemGeo() {
    const U = 40, V = 24, pos = [], fold = [], ka = [], kd = [], idx = [];
    for (let j = 0; j <= V; j++) for (let i = 0; i <= U; i++) { stem(i / U * Math.PI * 2, j / V, P); pos.push(P.x, P.y, P.z); fold.push(P.f); ka.push(keyA(P.x, P.y, P.z)); kd.push(keyD(P.x, P.y, P.z)); }
    for (let j = 0; j < V; j++) for (let i = 0; i < U; i++) { const a = j * (U + 1) + i, b = a + 1, c = a + U + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    g.setAttribute('aFold', new THREE.Float32BufferAttribute(fold, 1)); g.setAttribute('aKa', new THREE.Float32BufferAttribute(ka, 1)); g.setAttribute('aKd', new THREE.Float32BufferAttribute(kd, 1));
    return g;
  }

  const brain = new THREE.Group(); brain.position.set(0, 0.12, 0); scene.add(brain);
  const BU = { uFront: { value: -2 }, uDis: { value: 9 }, uAct: { value: 0 }, uTime: T, uGain: { value: 1 } };
  const brainMat = new THREE.ShaderMaterial({
    uniforms: BU,
    vertexShader: `attribute float aFold; attribute float aKa; attribute float aKd; varying float vFold; varying float vKa; varying float vKd; varying vec3 vN; varying vec3 vW; varying vec3 vL;
      void main(){ vFold=aFold; vKa=aKa; vKd=aKd; vL=position; vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uFront, uDis, uAct, uTime, uGain; varying float vFold; varying float vKa; varying float vKd; varying vec3 vN; varying vec3 vW; varying vec3 vL;
      void main(){
        if(vKa>uFront || vKd>uDis) discard;
        float scan=1.-smoothstep(0.,.07,uFront-vKa), burn=1.-smoothstep(0.,.045,uDis-vKd);
        vec3 N=normalize(vN); vec3 V=normalize(cameraPosition-vW);
        float fr=pow(1.-max(dot(N,V),0.),2.4);
        float key=max(dot(N,normalize(vec3(-.35,.75,.55))),0.);
        float crest=smoothstep(.1,.5,vFold), groove=1.-smoothstep(.0,.07,vFold);
        float outline=smoothstep(.07,.12,vFold)*(1.-smoothstep(.13,.27,vFold));
        vec3 col=vec3(.006,.014,.042)+vec3(.02,.06,.19)*key*crest;
        col+=vec3(.2,.48,1.)*fr*(.25+.9*crest);
        col+=vec3(.32,.66,1.)*outline*(.1+.38*key+.35*fr)*(1.+uAct*.6);
        float wave=.5+.5*sin(dot(vL,vec3(2.6,1.7,1.2))*3.2-uTime*2.4);
        float flick=.6+.4*sin(uTime*7.+vL.x*13.+vL.z*9.);
        col+=vec3(.3,.62,1.)*groove*(.06+uAct*(.25+1.2*pow(wave,6.))*flick);
        col+=vec3(.55,.85,1.)*(scan*1.4+burn*1.1);
        gl_FragColor=vec4(col*uGain,1.);
      }`
  });
  const cerebrumGeo = brainSurface(small ? 64 : 104, cerebrum);
  brain.add(new THREE.Mesh(cerebrumGeo, brainMat), new THREE.Mesh(brainSurface(small ? 28 : 44, cerebellum), brainMat), new THREE.Mesh(stemGeo(), brainMat));

  // energy paths: short jagged tracks over the cortex with pulses running along them
  const lineGain = { value: 0 };
  {
    const NP = small ? 90 : 170, SEG = 26, pos = [], aT = [], aO = [], ka = [], kd = [], idx = [];
    const A = new THREE.Vector3(), B = new THREE.Vector3(), D = new THREE.Vector3(), J = new THREE.Vector3();
    let base = 0;
    for (let p = 0; p < NP; p++) {
      A.set(rnd() * 2 - 1, rnd() * 1.6 - 0.6, rnd() * 2 - 1).normalize();
      B.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize().multiplyScalar(0.25 + rnd() * 0.45).add(A).normalize();
      const ph = rnd();
      for (let k = 0; k <= SEG; k++) {
        const t = k / SEG;
        J.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.05 * Math.sin(t * Math.PI));
        D.copy(A).lerp(B, t).add(J).normalize();
        cerebrum(D.x, D.y, D.z, P);
        const s = 1.014;
        pos.push(P.x * s, P.y * s, P.z * s); aT.push(t); aO.push(ph); ka.push(keyA(P.x, P.y, P.z)); kd.push(keyD(P.x, P.y, P.z));
        if (k < SEG) idx.push(base + k, base + k + 1);
      }
      base += SEG + 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1)); g.setAttribute('aO', new THREE.Float32BufferAttribute(aO, 1));
    g.setAttribute('aKa', new THREE.Float32BufferAttribute(ka, 1)); g.setAttribute('aKd', new THREE.Float32BufferAttribute(kd, 1)); g.setIndex(idx);
    brain.add(new THREE.LineSegments(g, new THREE.ShaderMaterial({
      ...ADD, uniforms: { uGain: lineGain, uTime: T, uFront: BU.uFront, uDis: BU.uDis },
      vertexShader: `attribute float aT; attribute float aO; attribute float aKa; attribute float aKd; varying float vT; varying float vO; varying float vKa; varying float vKd;
        void main(){ vT=aT; vO=aO; vKa=aKa; vKd=aKd; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform float uGain, uTime, uFront, uDis; varying float vT; varying float vO; varying float vKa; varying float vKd;
        void main(){ if(vKa>uFront || vKd>uDis) discard;
          float d=vT-fract(uTime*.42+vO);
          float b=.05+1.8*exp(-abs(d)*45.)+.55*step(d,0.)*exp(d*7.);
          gl_FragColor=vec4(vec3(.5,.85,1.)*b*uGain,1.); }`
    })));
  }

  // light rising from the pedestal into the brain stem
  const beamGain = { value: 1 };
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.5, 0.7, 64, 1, true), new THREE.ShaderMaterial({
    ...ADD, side: THREE.DoubleSide, uniforms: { uGain: beamGain, uTime: T },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uGain, uTime; varying vec2 vUv;
      void main(){ float s=.5+.5*sin(vUv.x*6.2832*16.+sin(vUv.x*37.)*2.); float s2=.5+.5*sin(vUv.x*6.2832*7.-uTime*.6);
        float a=pow(1.-vUv.y,1.8)*(.25+.75*s*s2)*(.85+.15*sin(uTime*3.+vUv.x*30.));
        gl_FragColor=vec4(vec3(.35,.65,1.)*a*uGain*.5,1.); }`
  }));
  beam.position.set(0.1, -1.1 + 0.35, 0); scene.add(beam);

  const ped1Gain = { value: 1 };
  const ped1 = makePedestal(1.0, ped1Gain, [[1.32, 0, 0, 0.9], [1.62, 3, 0.02, 0.7], [1.98, 5, -0.012, 0.45]]);
  ped1.position.set(0.1, -1.1 - 0.185, 0); scene.add(ped1);

  const orbAGain = { value: 0 }, orbBGain = { value: 0 };
  const orbA = makeOrbit(1.55, 0.0042, orbAGain, 0.07, 0.1); orbA.rotation.order = 'ZYX'; orbA.rotation.set(1.22, 0.1, 0.16); orbA.position.copy(EC); scene.add(orbA);
  const orbB = makeOrbit(1.78, 0.004, orbBGain, -0.05, 0.6); orbB.rotation.order = 'ZYX'; orbB.rotation.set(1.42, -0.2, -0.26); orbB.position.copy(EC); scene.add(orbB);

  /* ================= earth ================= */
  const earthTilt = new THREE.Group(); earthTilt.position.copy(EC); earthTilt.rotation.z = 0.3; scene.add(earthTilt);
  const EU = { map: { value: null }, uEC: { value: EC }, sunDir: SUN, uTime: T, uReveal: { value: 0 }, uLights: { value: 1 }, uDay: { value: 1 }, uCloud: { value: 1 } };
  const earthMat = new THREE.ShaderMaterial({
    uniforms: EU,
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying vec3 vP;
      void main(){ vUv=uv; vP=position; vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `${NOISE} uniform sampler2D map; uniform vec3 sunDir; uniform vec3 uEC; uniform float uTime, uReveal, uLights, uDay, uCloud; varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying vec3 vP;
      void main(){
        float rn=dot(normalize(vW-uEC),normalize(vec3(.8,.25,.35)))*-.5+.5+snoise(vP*7.)*.07+snoise(vP*2.)*.05; float rv=uReveal*1.3-.15;
        if(rn>rv) discard;
        float edge=1.-smoothstep(0.,.06,rv-rn);
        vec3 t=texture2D(map,vUv).rgb; float land=t.r; float lights=pow(t.g,1.6)*1.3;
        vec3 N=normalize(vN); vec3 V=normalize(cameraPosition-vW);
        float ndl=dot(N,sunDir); float day=smoothstep(-.1,.3,ndl); float night=1.-smoothstep(-.22,.06,ndl);
        vec3 q=vP*2.2+vec3(uTime*.004,0.,0.);
        float c=snoise(q)*.55+snoise(q*2.1+3.)*.28+snoise(q*4.4+7.)*.15${small ? '' : '+snoise(q*9.+1.)*.07'};
        float cloud=smoothstep(.1,.6,c)*uCloud;
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
        // while it assembles: a grid of data lines and a bright seam
        float grid=max(1.-smoothstep(.0,.06,abs(fract(vUv.x*36.)-.5)*2.-.9),1.-smoothstep(.0,.06,abs(fract(vUv.y*18.)-.5)*2.-.9));
        float build=1.-smoothstep(.75,1.,uReveal);
        col+=vec3(.25,.55,1.)*(grid*.25+land*.18)*build;
        col+=vec3(.4,.75,1.)*edge*1.1*build;
        gl_FragColor=vec4(col,1.);
      }`
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, small ? 96 : 144, small ? 64 : 96), earthMat);
  earthTilt.add(earth);
  const atmoGain = { value: 0 };
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.11, 96, 64), new THREE.ShaderMaterial({
    uniforms: { sunDir: SUN, uGain: atmoGain }, side: THREE.BackSide, ...ADD,
    vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 sunDir; uniform float uGain; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 V=normalize(cameraPosition-vW); vec3 N=normalize(vN);
        float rim=pow(clamp(abs(dot(N,V))/.45,0.,1.),2.4);
        float lit=.2+1.2*smoothstep(-.6,.5,dot(N,sunDir));
        gl_FragColor=vec4(vec3(.25,.55,1.)*rim*lit*1.3*uGain,rim*lit*uGain); }`
  }));
  earthTilt.add(atmo);

  // light routes between cities: only behind the page (S > 10)
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

  /* ================= data particles: brain surface -> burst -> sphere -> earth ================= */
  const NPART = small ? 15000 : 32000;
  const pA = new Float32Array(NPART * 3), pB = new Float32Array(NPART * 3), pR = new Float32Array(NPART * 4), pK = new Float32Array(NPART * 4);
  {
    const d = new THREE.Vector3();
    for (let i = 0; i < NPART; i++) {
      const u = rnd();
      let nx, ny, nz;
      if (u < 0.82) { d.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1); while (d.lengthSq() > 1 || d.lengthSq() < 0.01) d.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1); d.normalize(); cerebrum(d.x, d.y, d.z, P); nx = P.x; ny = P.y; nz = P.z; }
      else if (u < 0.95) { d.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize(); cerebellum(d.x, d.y, d.z, P); nx = P.x - 0.56; ny = P.y + 0.43; nz = P.z; }
      else { const n = stem(rnd() * Math.PI * 2, rnd(), P); nx = n[0]; ny = 0; nz = n[2]; }
      const l = Math.hypot(nx, ny, nz) || 1, off = 0.007;
      pA[i * 3] = P.x + nx / l * off; pA[i * 3 + 1] = P.y + ny / l * off; pA[i * 3 + 2] = P.z + nz / l * off;
      const spark = i % 23 === 0 ? 1 : 0;
      pR[i * 4] = rnd(); pR[i * 4 + 1] = rnd(); pR[i * 4 + 2] = spark ? 2 + rnd() : rnd(); pR[i * 4 + 3] = rnd();
      pK[i * 4] = keyA(P.x, P.y, P.z); pK[i * 4 + 1] = keyD(P.x, P.y, P.z); pK[i * 4 + 2] = spark ? 2.6 : 0.35 + 0.65 * sstep(0.08, 0.45, P.f); pK[i * 4 + 3] = 0;
      d.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize(); pB[i * 3] = d.x; pB[i * 3 + 1] = d.y; pB[i * 3 + 2] = d.z;
    }
  }
  const partGeo = new THREE.BufferGeometry();
  partGeo.setAttribute('position', new THREE.BufferAttribute(pA, 3));
  partGeo.setAttribute('aB', new THREE.BufferAttribute(pB, 3));
  partGeo.setAttribute('aR', new THREE.BufferAttribute(pR, 4));
  partGeo.setAttribute('aK', new THREE.BufferAttribute(pK, 4));
  const PU = { uS: { value: 0 }, uTime: T, uFront: BU.uFront, uAct: BU.uAct, uDpr: { value: DPR }, uProj: PROJ, uBrainM: { value: brain.matrixWorld }, uEarthR: { value: new THREE.Matrix3() }, uEC: { value: EC } };
  const parts = new THREE.Points(partGeo, new THREE.ShaderMaterial({
    ...ADD, uniforms: PU,
    vertexShader: `attribute vec3 aB; attribute vec4 aR; attribute vec4 aK;
      uniform float uS, uTime, uFront, uAct, uDpr, uProj; uniform mat4 uBrainM; uniform mat3 uEarthR; uniform vec3 uEC;
      varying vec3 vC; varying float vA;
      float io(float t){ return t<.5?4.*t*t*t:1.-pow(-2.*t+2.,3.)/2.; }
      void main(){
        vec3 p0=(uBrainM*vec4(position,1.)).xyz;
        vec3 dB=uEarthR*aB; vec3 p3=uEC+dB*(1.014+aR.w*.012);
        float rel=2.05+(1.4-aK.y)/2.8+aR.x*.07;
        float s=clamp((uS-rel)/(.95+aR.y*.45),0.,1.); float e=io(s);
        vec3 p1=p0+vec3(.7+aR.z*1.3,(aR.w-.5)*.7+.1,(aR.x-.5)*.9);
        vec3 p2=uEC+dB*(1.9+fract(aR.z*7.)*.9)+vec3(.7*(1.-aR.y),0.,0.);
        vec3 a=mix(p0,p1,e), b=mix(p1,p2,e), c=mix(p2,p3,e); vec3 p=mix(mix(a,b,e),mix(b,c,e),e);
        float sw=e*(1.-e)*4.*(1.1+aR.w*1.2); vec3 q=p-uEC; float cs=cos(sw), sn=sin(sw); q.xz=mat2(cs,-sn,sn,cs)*q.xz; p=uEC+q;
        float fl=s*(1.-s)*4., onS=smoothstep(.9,1.,s), spark=step(1.5,aK.z);
        float shown=smoothstep(0.,.03,uFront-aK.x)*(1.+2.5*exp(-(uFront-aK.x)*25.)*(1.-step(.001,s)));
        float fo=1.-smoothstep(4.5+aR.x*.35,5.1+aR.x*.35,uS);
        float tw=.6+.4*sin(uTime*(2.+aR.y*3.)+aR.w*40.);
        float b0=mix(.5*aK.z*(1.+uAct*.8*spark),1.,fl)*mix(tw,1.,fl);
        b0*=mix(1.,mix(.9,2.2,min(aK.w,1.)),onS);
        vA=shown*fo*b0;
        vC=mix(vec3(.42,.72,1.),vec3(.82,.94,1.),fl);
        vC=mix(vC,mix(vec3(.3,.55,1.),aK.w>1.5?vec3(1.,.85,.6):vec3(.72,.88,1.),min(aK.w,1.)),onS);
        vec4 mv=viewMatrix*vec4(p,1.);
        gl_Position=projectionMatrix*mv;
        float size=(spark>.5?.013:.0046+.0042*aR.z)*(1.+fl*.6+onS*.35);
        gl_PointSize=clamp(size*uProj*uDpr/-mv.z,1.,24.);
      }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.0,d); a*=a; gl_FragColor=vec4(vC,a*vA); }`
  }));
  parts.frustumCulled = false; scene.add(parts);

  // the sphere targets follow the real continents once the earth texture is decoded
  function placeOnLand(img) {
    if (S > 1.8) return;
    const w = 512, h = 256, c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h);
    const px = g.getImageData(0, 0, w, h).data;
    const pick = want => { for (let t = 0; t < 60; t++) { const u = rnd(), v = Math.acos(1 - 2 * rnd()) / Math.PI, k = (Math.floor(v * h) * w + Math.floor(u * w)) * 4;
      const land = px[k] > 110, li = px[k + 1] > 70; if (want === 0 || (want === 1 && land) || (want === 2 && li)) return [u, v, land ? (li ? 2 : 1) : 0]; } return [rnd(), 0.5, 0]; };
    for (let i = 0; i < NPART; i++) {
      const spark = pK[i * 4 + 2] > 1.5, r = rnd();
      const [u, v, kind] = pick(spark ? 2 : r < 0.62 ? 1 : 0);
      const p = ll(u * 360 - 180, 90 - v * 180);
      pB[i * 3] = p.x; pB[i * 3 + 1] = p.y; pB[i * 3 + 2] = p.z; pK[i * 4 + 3] = kind;
    }
    partGeo.attributes.aB.needsUpdate = true; partGeo.attributes.aK.needsUpdate = true;
  }

  /* ================= glass cubes thrown out by the transformation ================= */
  const cubeGain = { value: 1 };
  const cubes = (() => {
    const NC = small ? 26 : 46, box = new THREE.BoxGeometry(1, 1, 1), g = new THREE.InstancedBufferGeometry();
    g.index = box.index; g.setAttribute('position', box.attributes.position); g.setAttribute('normal', box.attributes.normal); g.setAttribute('uv', box.attributes.uv);
    const p0 = new Float32Array(NC * 3), r4 = new Float32Array(NC * 4), ax = new Float32Array(NC * 3);
    for (let i = 0; i < NC; i++) {
      const d = new THREE.Vector3(0.2 + rnd(), rnd() * 2 - 1, rnd() * 2 - 1).normalize(); cerebrum(d.x, d.y, d.z, P);
      p0[i * 3] = P.x; p0[i * 3 + 1] = P.y; p0[i * 3 + 2] = P.z;
      r4[i * 4] = rnd(); r4[i * 4 + 1] = rnd(); r4[i * 4 + 2] = rnd(); r4[i * 4 + 3] = rnd();
      ax[i * 3] = rnd() - 0.5; ax[i * 3 + 1] = rnd() - 0.5; ax[i * 3 + 2] = rnd() - 0.5;
    }
    g.setAttribute('aP0', new THREE.InstancedBufferAttribute(p0, 3)); g.setAttribute('aR', new THREE.InstancedBufferAttribute(r4, 4)); g.setAttribute('aAx', new THREE.InstancedBufferAttribute(ax, 3));
    g.instanceCount = NC;
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
      ...ADD, side: THREE.DoubleSide, uniforms: { uS: PU.uS, uTime: T, uBrainM: PU.uBrainM, uEC: PU.uEC, uGain: cubeGain },
      vertexShader: `attribute vec3 aP0; attribute vec4 aR; attribute vec3 aAx; uniform float uS, uTime; uniform mat4 uBrainM; uniform vec3 uEC;
        varying vec2 vUv; varying vec3 vN; varying vec3 vW;
        mat3 rot(vec3 a, float g){ a=normalize(a); float s=sin(g), c=cos(g), oc=1.-c;
          return mat3(oc*a.x*a.x+c, oc*a.x*a.y+a.z*s, oc*a.z*a.x-a.y*s, oc*a.x*a.y-a.z*s, oc*a.y*a.y+c, oc*a.y*a.z+a.x*s, oc*a.z*a.x+a.y*s, oc*a.y*a.z-a.x*s, oc*a.z*a.z+c); }
        void main(){
          float t0=2.05+aR.x*.8; float s=clamp((uS-t0)/1.7,0.,1.); float e=1.-pow(1.-s,3.);
          vec3 p0=(uBrainM*vec4(aP0,1.)).xyz;
          float orR=1.3+aR.y*.95, a0=aR.z*6.2832, spin=max(uS-t0,0.)*(.45+aR.w*.5)+uTime*.04;
          vec3 orb=uEC+vec3(cos(a0+spin)*orR,(aR.y-.5)*.9+sin(a0*2.+spin)*.25,sin(a0+spin)*orR*.8);
          vec3 mid=p0+vec3(.9+aR.y*1.4,(aR.w-.5)*.9,(aR.z-.5)*.9);
          vec3 p=mix(mix(p0,mid,e),mix(mid,orb,e),e);
          float sc=(.03+aR.w*.06)*smoothstep(0.,.06,s)*(1.-smoothstep(4.05+aR.x*.35,4.6+aR.x*.35,uS));
          mat3 R=rot(aAx,uTime*(.5+aR.x)+uS*2.3);
          vec4 w=vec4(p+R*position*sc,1.); vW=w.xyz; vN=R*normal; vUv=uv;
          gl_Position=projectionMatrix*viewMatrix*w;
        }`,
      fragmentShader: `uniform float uGain; varying vec2 vUv; varying vec3 vN; varying vec3 vW;
        void main(){ float e=min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y)); float edge=1.-smoothstep(.03,.11,e);
          vec3 V=normalize(cameraPosition-vW); float fr=pow(1.-abs(dot(normalize(vN),V)),2.);
          gl_FragColor=vec4((vec3(.3,.6,1.)*(.08+.3*fr)+vec3(.7,.9,1.)*edge*.75)*uGain,1.); }`
    }));
    m.frustumCulled = false; scene.add(m);
    return m;
  })();

  /* ================= sun: soft glare beyond the limb and a star burst on it ================= */
  function spriteTex(draw) { const c = document.createElement('canvas'); c.width = c.height = 512; draw(c.getContext('2d'), 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
  const glareTex = spriteTex((g, h) => { const r = g.createRadialGradient(h, h, 0, h, h, h); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.05, 'rgba(220,238,255,.9)'); r.addColorStop(0.2, 'rgba(110,165,255,.42)'); r.addColorStop(0.5, 'rgba(50,100,255,.12)'); r.addColorStop(1, 'rgba(30,70,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 2 * h, 2 * h); });
  const burstTex = spriteTex((g, h) => {
    const r = g.createRadialGradient(h, h, 0, h, h, h * 0.5); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.08, 'rgba(235,245,255,.95)'); r.addColorStop(0.3, 'rgba(140,190,255,.35)'); r.addColorStop(1, 'rgba(60,120,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 2 * h, 2 * h);
    g.globalCompositeOperation = 'lighter';
    for (const [ang, len, wd, al] of [[0, 1, 5, 0.9], [90, 0.55, 4, 0.55], [30, 0.36, 2, 0.35], [150, 0.36, 2, 0.35], [60, 0.28, 2, 0.25], [120, 0.28, 2, 0.25]]) {
      g.save(); g.translate(h, h); g.rotate(ang * D2R);
      const lg = g.createLinearGradient(-h * len, 0, h * len, 0); lg.addColorStop(0, 'rgba(120,170,255,0)'); lg.addColorStop(0.5, `rgba(235,245,255,${al})`); lg.addColorStop(1, 'rgba(120,170,255,0)');
      g.fillStyle = lg; g.beginPath(); g.ellipse(0, 0, h * len, wd, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
  });
  const glare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glareTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  const burst = new THREE.Sprite(new THREE.SpriteMaterial({ map: burstTex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }));
  burst.renderOrder = 50; scene.add(glare, burst);

  /* ================= the AI stage (scenes 9 and 10, the original picture) ================= */
  const stage = new THREE.Group(); scene.add(stage);
  const SG = { ped: { value: 0 }, pedR: { value: 0 }, floor: { value: 0 }, glass: { value: 0 }, glassR: { value: 0 }, build: { value: 0 }, orbit: { value: 0 }, orbitR: { value: 0 }, spark: { value: 0 }, halo: { value: 0 } };
  const PED_R = 1.05, STAGE_SC = { value: 1 };
  const ped2 = makePedestal(PED_R, SG.ped, [[1.45, 0, 0, 0.8], [1.85, 4, 0.01, 0.55], [2.4, 6, -0.008, 0.4], [3.2, 3, 0.005, 0.28]], 3);
  stage.add(ped2);
  const TOP = ped2.userData.top;

  // A and I as extruded glass: a flat-topped A with a triangular counter, a plain bar for the I
  const letterGeo = (() => {
    const A = new THREE.Shape(); A.moveTo(-0.5, 0); A.lineTo(-0.28, 0); A.lineTo(-0.176, 0.26); A.lineTo(0.176, 0.26); A.lineTo(0.28, 0); A.lineTo(0.5, 0); A.lineTo(0.1, 1); A.lineTo(-0.1, 1); A.closePath();
    const hole = new THREE.Path(); hole.moveTo(-0.108, 0.43); hole.lineTo(0.108, 0.43); hole.lineTo(0, 0.7); hole.closePath(); A.holes.push(hole);
    const I = new THREE.Shape(); I.moveTo(0.6, 0); I.lineTo(0.84, 0); I.lineTo(0.84, 1.04); I.lineTo(0.6, 1.04); I.closePath();
    const g = new THREE.ExtrudeGeometry([A, I], { depth: 0.24, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.022, bevelSegments: 2, curveSegments: 1 });
    g.translate(-0.17, 0.022, -0.12); return g;
  })();
  const edgeGeo = new THREE.EdgesGeometry(letterGeo, 28);
  function glassMat(gainU, side, order) {
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side, uniforms: { uGain: gainU, uBuild: SG.build, uSun: SUN, uTime: T },
      vertexShader: VS_WORLD,
      fragmentShader: `uniform float uGain, uBuild, uTime; uniform vec3 uSun; varying vec3 vN; varying vec3 vW; varying vec3 vL;
        void main(){
          float b=uBuild*1.3-.12; if(vL.y>b) discard;
          float scan=1.-smoothstep(0.,.06,b-vL.y);
          vec3 N=normalize(vN)*(gl_FrontFacing?1.:-1.); vec3 V=normalize(cameraPosition-vW);
          float fr=pow(1.-abs(dot(N,V)),2.);
          vec3 R=reflect(-V,N);
          vec3 env=vec3(.22,.48,1.)*exp(-pow(R.y*4.,2.))*1.1+vec3(.05,.12,.34)*smoothstep(-.2,.8,R.y)+vec3(.75,.88,1.)*pow(max(dot(R,uSun),0.),24.)*.9;
          float lift=1.-smoothstep(0.,1.1,vL.y);
          vec3 col=vec3(.05,.13,.36)*(.7+.7*lift)+env*(.45+1.1*fr)+vec3(.25,.55,1.)*lift*.3;
          col+=vec3(.6,.86,1.)*scan*1.8;
          gl_FragColor=vec4(col*uGain,(.42+.5*fr+scan*.4)*uGain);
        }`
    });
    return m;
  }
  function edgeMat(gainU) {
    return new THREE.ShaderMaterial({
      ...ADD, uniforms: { uGain: gainU, uBuild: SG.build, uTime: T },
      vertexShader: `varying vec3 vL; void main(){ vL=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform float uGain, uBuild, uTime; varying vec3 vL; void main(){ float b=uBuild*1.3-.12; if(vL.y>b) discard;
        float lift=1.-smoothstep(0.,1.1,vL.y); gl_FragColor=vec4(vec3(.62,.84,1.)*(.4+.45*lift)*uGain,1.); }`
    });
  }
  function letters(gainU, order) {
    const g = new THREE.Group();
    const back = new THREE.Mesh(letterGeo, glassMat(gainU, THREE.BackSide)); back.renderOrder = order;
    const front = new THREE.Mesh(letterGeo, glassMat(gainU, THREE.FrontSide)); front.renderOrder = order + 1;
    const edges = new THREE.LineSegments(edgeGeo, edgeMat(gainU)); edges.renderOrder = order + 2;
    g.add(back, front, edges); g.position.y = TOP; return g;
  }
  stage.add(letters(SG.glass, 6));
  // soft light behind the letters
  const haloTex = spriteTex((g, h) => { const r = g.createRadialGradient(h, h, 0, h, h, h); r.addColorStop(0, 'rgba(90,150,255,.55)'); r.addColorStop(0.45, 'rgba(50,100,255,.16)'); r.addColorStop(1, 'rgba(30,70,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 2 * h, 2 * h); });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  halo.position.set(0, TOP + 0.45, -0.4); halo.scale.set(3.6, 2.4, 1); halo.renderOrder = 2; stage.add(halo);
  // the orbit around the letters
  const orb2 = makeOrbit(1.2, 0.008, SG.orbit, 0.09, 0.3, 0x9fdcff); orb2.rotation.order = 'ZYX'; orb2.rotation.set(1.28, 0, 0.36); orb2.position.set(0.04, TOP + 0.5, 0); orb2.children.forEach(c => { c.renderOrder = 9; }); stage.add(orb2);
  // mirror images under the glass floor
  const mirror = new THREE.Group(); mirror.scale.y = -1; stage.add(mirror);
  {
    const l2 = letters(SG.glassR, 0); mirror.add(l2);
    const p2 = makePedestal(PED_R, SG.pedR, [], 0); p2.children.forEach(c => { c.renderOrder = 0; }); mirror.add(p2);
    const o2 = makeOrbit(1.2, 0.008, SG.orbitR, 0.09, 0.3, 0x9fdcff); o2.rotation.order = 'ZYX'; o2.rotation.copy(orb2.rotation); o2.position.copy(orb2.position); mirror.add(o2);
  }
  // the dark glass floor: hides what lies under it, keeps faint reflections
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uGain: SG.floor, uTime: T },
    vertexShader: VS_WORLD,
    fragmentShader: `${NOISE} uniform float uGain, uTime; varying vec3 vL; varying vec3 vW;
      void main(){
        vec2 p=vL.xy; float r=length(p*vec2(.42,1.));
        float fall=1.-smoothstep(2.,11.,r);
        float rr=length(p);
        vec3 col=vec3(.006,.013,.034)+vec3(.05,.13,.38)*exp(-rr*.8)*.55;
        float streak=smoothstep(.55,1.,snoise(vec3(p.x*.35,p.y*3.,1.)))*.04;
        col+=vec3(.2,.4,.9)*streak;
        gl_FragColor=vec4(col*uGain,.86*fall*uGain);
      }`
  }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.001; floor.renderOrder = 2; stage.add(floor);
  // sparks that gather into the letters
  const sparkPts = (() => {
    const pa = letterGeo.attributes.position, n = pa.count / 3, area = [], tot = [];
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(); let sum = 0;
    for (let i = 0; i < n; i++) { a.fromBufferAttribute(pa, i * 3); b.fromBufferAttribute(pa, i * 3 + 1); c.fromBufferAttribute(pa, i * 3 + 2); sum += b.sub(a).cross(c.sub(a)).length() / 2; tot.push(sum); }
    const NS = small ? 900 : 1800, dst = new Float32Array(NS * 3), src = new Float32Array(NS * 3), rr = new Float32Array(NS);
    for (let k = 0; k < NS; k++) {
      const t = rnd() * sum; let lo = 0, hi = n - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (tot[m] < t) lo = m + 1; else hi = m; }
      a.fromBufferAttribute(pa, lo * 3); b.fromBufferAttribute(pa, lo * 3 + 1); c.fromBufferAttribute(pa, lo * 3 + 2);
      let u = rnd(), v = rnd(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
      const p = a.clone().addScaledVector(b.clone().sub(a), u).addScaledVector(c.clone().sub(a), v);
      dst[k * 3] = p.x; dst[k * 3 + 1] = p.y + TOP; dst[k * 3 + 2] = p.z;
      const d = new THREE.Vector3(rnd() * 2 - 1, rnd() * 1.4 - 0.2, rnd() * 2 - 1).normalize().multiplyScalar(1.6 + rnd() * 2.6);
      src[k * 3] = d.x; src[k * 3 + 1] = d.y + TOP + 0.5; src[k * 3 + 2] = d.z; rr[k] = rnd();
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(dst, 3)); g.setAttribute('aSrc', new THREE.BufferAttribute(src, 3)); g.setAttribute('aR', new THREE.BufferAttribute(rr, 1));
    const m = new THREE.Points(g, new THREE.ShaderMaterial({
      ...ADD, uniforms: { uS: PU.uS, uGain: SG.spark, uDpr: PU.uDpr, uProj: PROJ, uTime: T, uSc: STAGE_SC },
      vertexShader: `attribute vec3 aSrc; attribute float aR; uniform float uS, uDpr, uProj, uTime, uSc; varying float vA;
        void main(){ float s=clamp((uS-8.15-aR*.55)/.85,0.,1.); float e=1.-pow(1.-s,3.);
          vec3 p=mix(aSrc,position,e); float sw=(1.-e)*1.6; p.xz=mat2(cos(sw),-sin(sw),sin(sw),cos(sw))*p.xz;
          vA=smoothstep(0.,.1,s)*(1.-smoothstep(.85,1.,s)*.75)*(.7+.3*sin(uTime*5.+aR*50.));
          vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=clamp(.035*uSc*uProj*uDpr/-mv.z,1.,10.); }`,
      fragmentShader: `uniform float uGain; varying float vA; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,d); gl_FragColor=vec4(vec3(.65,.88,1.),a*a*vA*uGain); }`
    }));
    m.frustumCulled = false; m.renderOrder = 10; return m;
  })();
  stage.add(sparkPts);

  /* ================= camera shots ================= */
  const V3 = () => new THREE.Vector3();
  const _a = V3(), _b = V3(), _c = V3();
  let aspect = 1, fovV = 38;
  function fitDist(r) { const v = fovV * D2R, h = 2 * Math.atan(Math.tan(v / 2) * aspect); return r / Math.sin(Math.min(v, h) / 2); }
  // looking at a target from a direction (az, el in degrees), far enough to fit radius r
  function orbit(o) {
    const t = V3().set(...o.t), el = o.el * D2R, az = o.az * D2R, dir = V3().set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    const pos = t.clone().addScaledVector(dir, fitDist(o.r)), F = dir.clone().negate();
    const U = V3().set(0, 1, 0).addScaledVector(F, -F.y).normalize().applyAxisAngle(F, (o.roll || 0) * D2R);
    return { pos, F, U };
  }
  // around the earth: camera at (az, el, d) from its centre, which then appears at screen angle (ox, oy)
  function aim(o) {
    const el = o.el * D2R, az = o.az * D2R, u = V3().set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    const pos = EC.clone().addScaledVector(u, o.d), v = u.clone().negate();
    const U0 = V3().set(0, 1, 0).addScaledVector(v, -v.y).normalize(), R0 = V3().crossVectors(v, U0);
    const F = v.clone().addScaledVector(R0, -Math.tan(o.ox * D2R)).addScaledVector(U0, -Math.tan(o.oy * D2R)).normalize();
    const U = U0.clone().addScaledVector(F, -U0.dot(F)).normalize().applyAxisAngle(F, (o.roll || 0) * D2R);
    return { pos, F, U };
  }
  const L = (p, l) => mix(p, l, sstep(0.75, 1.45, aspect));   // portrait value, landscape value
  const SHOTS = [
    () => orbit({ t: [0.05, -0.24, 0], az: 24, el: 7, r: L(1.75, 1.62) }),
    () => orbit({ t: [0.05, -0.1, 0], az: 14, el: 6, r: L(1.6, 1.48) }),
    () => orbit({ t: [0.03, -0.02, 0], az: 4, el: 5, r: L(1.5, 1.36) }),
    () => orbit({ t: [L(0.35, 0.6), 0.02, 0], az: -6, el: 7, r: L(2.2, 1.95) }),
    () => orbit({ t: [0, 0.0, 0], az: -16, el: 9, r: L(1.75, 1.6) }),
    () => orbit({ t: [0, 0.1, 0], az: -26, el: 12, r: L(1.5, 1.42) }),
    () => orbit({ t: [0, 0.1, 0], az: -42, el: 15, r: L(1.42, 1.3) }),
    () => aim({ az: -60, el: -4, d: 1.45, ox: 0, oy: L(-34, -37), roll: 4 }),
    () => aim({ az: -76, el: -9, d: L(2.8, 3.1), ox: L(-4, -8), oy: L(-24, -21), roll: 3 }),
    () => aim({ az: -78, el: -8, d: L(2.6, 2.86), ox: L(-7, -15), oy: L(-24, -19), roll: 1 }),
    () => aim({ az: -78, el: -8, d: L(2.4, 2.67), ox: L(-8, -18), oy: L(-24, -18), roll: 0 }),
    () => aim({ az: -110, el: 14, d: L(5.4, 4.6), ox: 0, oy: L(-7, -4.5), roll: 0 })
  ];
  let keys = [];
  function evalShots() { keys = SHOTS.map(f => f()); placeStage(); }
  // the stage stands in front of the final camera, right of centre, sized like the original picture
  function placeStage() {
    const k = keys[10], R = V3().crossVectors(k.F, k.U).normalize();
    const z = 0.3, x = L(0.02, 0.235) * z, y = L(-0.36, -0.155) * z, sc = L(0.155, 0.205) * z;
    stage.position.copy(k.pos).addScaledVector(k.F, z).addScaledVector(R, x).addScaledVector(k.U, y);
    stage.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(R, k.U, k.F.clone().negate()));
    stage.scale.setScalar(sc); STAGE_SC.value = sc;
  }
  // Catmull-Rom through the shots: position around the earth centre, view and up vectors
  function cr(p0, p1, p2, p3, t) { const t2 = t * t, t3 = t2 * t; return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); }
  function crV(out, a, b, c, d, t) { return out.set(cr(a.x, b.x, c.x, d.x, t), cr(a.y, b.y, c.y, d.y, t), cr(a.z, b.z, c.z, d.z, t)); }
  const camPos = V3(), camF = V3(), camU = V3();
  function shotAt(s) {
    // the camera settles into the end frame and starts gently out of it
    let x = s;
    if (s > 9 && s < 10) x = 9 + Math.sin((s - 9) * Math.PI / 2);
    else if (s >= 10 && s < 11) x = 10 + sstep(0, 1, s - 10);
    x = clamp(x, 0, keys.length - 1);
    const i = Math.min(Math.floor(x), keys.length - 2), t = x - i;
    // the end frame (key 10) is an end point for both sides: no overshoot around the AI stage
    const k1 = keys[i], k2 = keys[i + 1], k0 = i === 10 ? k1 : keys[Math.max(i - 1, 0)], k3 = i + 1 === 10 ? k2 : keys[Math.min(i + 2, keys.length - 1)];
    const rel = k => _a.copy(k.pos).sub(EC);
    const d = [k0, k1, k2, k3].map(k => Math.log(rel(k).length()));
    const dirs = [k0, k1, k2, k3].map(k => rel(k).normalize().clone());
    crV(_b, ...dirs, t).normalize();
    camPos.copy(EC).addScaledVector(_b, Math.exp(cr(...d, t)));
    crV(camF, k0.F, k1.F, k2.F, k3.F, t).normalize();
    crV(camU, k0.U, k1.U, k2.U, k3.U, t);
    camU.addScaledVector(camF, -camU.dot(camF)).normalize();
  }

  /* ================= timeline tracks ================= */
  const SPX = 1.57;
  const earthSpin = track([[3, 0], [4, 0.3], [5, 0.75], [6, 1.6], [7, 2.05 + SPX], [8, 2.3 + SPX], [10, 2.45 + SPX], [11, 2.7 + SPX]]);
  
  const sunAlpha = track([[4.5, -45], [5, -45], [6, -78], [7, -14], [8, 0], [9, -3], [10, -4], [10.5, -15], [11, -48]]);
  const sunLight = track([[4.5, 100], [6, 95], [7, 6], [8, -3], [10, -3], [10.5, 20], [11, 72]]);
  const burstK = track([[4.5, 0], [5.3, 0.75], [6, 0.95], [7, 1], [8, 1.15], [10, 1.15], [10.6, 0.6], [11, 0.38]]);
  const lightsK = track([[4.5, 0.5], [6, 0.85], [7.5, 1.1], [10, 1.15], [11, 0.75]]);
  const dayK = track([[5, 1.35], [6.4, 1.3], [7.4, 0.75], [10, 0.75], [11, 0.7]]);

  /* ================= scroll -> timeline ================= */
  const HOLD = 0.6;   // the end frame stays a moment before the page arrives
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
  addEventListener('scroll', readScroll, { passive: true });

  function resize() {
    const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false);
    aspect = w / h; fovV = mix(58, 38, sstep(0.6, 1.4, aspect));
    camera.aspect = aspect; camera.fov = fovV; camera.updateProjectionMatrix();
    PROJ.value = h / (2 * Math.tan(fovV * D2R / 2));
    measure(); evalShots(); readScroll();
  }
  addEventListener('resize', resize);
  resize();
  S = target;

  // the earth texture: the planet's look and the shape the particles gather into
  const tex = new THREE.TextureLoader().load(new URL(small ? './earth-2k.webp' : './earth-4k.webp', import.meta.url).href, t => { try { placeOnLand(t.image); } catch (e) { /* uniform targets stay */ } });
  tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  EU.map.value = tex;

  /* ================= per frame ================= */
  const v = V3(), w = V3(), sdir = V3(), lim = V3(), m3 = new THREE.Matrix3();
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

  function update(s, dt) {
    PU.uS.value = s;
    // brain: appears on load, then the scroll takes over
    const appear = Math.max(auto, sstep(0, 0.9, s));
    BU.uFront.value = mix(-1.35, 1.0, appear);
    BU.uAct.value = band(s, 0.7, 1.9, 2.5, 3.0);
    BU.uDis.value = 1.4 - 2.8 * clamp((s - 2.05) / 1.0);
    lineGain.value = band(s, 0.8, 1.7, 2.2, 2.7) * 1.1;
    brain.visible = s < 3.1;
    beamGain.value = Math.max(0, appear - 0.1) * (1 - sstep(2.1, 3.0, s));
    beam.visible = beamGain.value > 0.003;
    ped1Gain.value = 1 - sstep(4.3, 5.0, s); ped1.visible = beam.visible || ped1Gain.value > 0.003;
    orbAGain.value = band(s, 1.2, 2.0, 5.1, 5.9); orbA.visible = orbAGain.value > 0.003;
    orbBGain.value = band(s, 3.1, 3.9, 5.1, 5.9); orbB.visible = orbBGain.value > 0.003;
    parts.visible = s < 5.5; cubes.visible = s > 2 && s < 5.0;
    // earth
    EU.uReveal.value = sstep(3.95, 5.0, s);
    earth.visible = s > 3.9;
    atmoGain.value = sstep(4.4, 5.4, s); atmo.visible = atmoGain.value > 0.003;
    depth += (depthT - depth) * Math.min(1, dt * 3);
    EU.uLights.value = lightsK(s) * (1 - 0.45 * depth); EU.uDay.value = dayK(s) * (1 - 0.3 * depth);
    if (s > 10.3) bgSpin += dt * 0.032 * (reduce ? 0 : 1) * sstep(10.3, 11, s);
    earth.rotation.y = -0.9 + earthSpin(s) + bgSpin + T.value * 0.004;
    routeGain.value = sstep(10.4, 11, s);
    earthTilt.updateMatrixWorld(true);
    PU.uEarthR.value.setFromMatrix4(earth.matrixWorld);
    brain.updateMatrixWorld(true);
    // stage
    SG.ped.value = sstep(8.0, 8.7, s) * (1 - sstep(10.02, 10.32, s));
    SG.build.value = sstep(8.45, 9.35, s);
    SG.glass.value = sstep(8.4, 8.7, s) * (1 - sstep(10.0, 10.28, s));
    SG.floor.value = sstep(8.2, 9.0, s) * (1 - sstep(10.04, 10.4, s));
    SG.orbit.value = sstep(8.9, 9.6, s) * (1 - sstep(10.0, 10.25, s));
    SG.spark.value = band(s, 8.1, 8.3, 9.3, 9.7);
    SG.pedR.value = SG.ped.value * 0.35; SG.glassR.value = SG.glass.value * 0.4; SG.orbitR.value = SG.orbit.value * 0.35;
    halo.material.opacity = SG.glass.value * 0.8;
    stage.visible = s > 7.95 && s < 10.45;
    skyGain.value = 1;
    // camera
    shotAt(s);
    camera.position.copy(camPos); camera.up.copy(camU); camera.lookAt(_c.copy(camPos).add(camF));
    camera.updateMatrixWorld();
    sky.position.copy(camera.position);
    sun(sunAlpha(s), sunLight(s), burstK(s) * sstep(4.4, 5.3, s) * (1 - 0.5 * depth));
  }

  let visible = !document.hidden, last = performance.now(), born = last, frames = 0;
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible) { last = performance.now(); requestAnimationFrame(frame); } });
  function frame(now) {
    if (!visible) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!reduce) T.value += dt;
    auto = reduce ? 1 : sstep(0, 2600, now - born);
    if (Math.abs(target - S) > 1.6) S = target - Math.sign(target - S) * 1.6;   // a jump (anchor link) plays at most 1.6 scenes
    S += (target - S) * (reduce ? 1 : 1 - Math.pow(0.006, dt));
    if (Math.abs(target - S) < 1e-4) S = target;
    update(S, dt);
    renderer.render(scene, camera);
    if (++frames === 2) canvas.classList.add('is-ready');
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
  }
  requestAnimationFrame(frame);
  renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); fail(); });
  window.__scene = { set: s => { target = S = s; }, snap: () => { readScroll(); S = target; }, get S() { return S; }, keys: () => keys };
}

try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, alpha: false, powerPreference: 'high-performance' });
} catch (e) { fail(); }
if (renderer) { try { start(); } catch (e) { console.error(e); fail(); } }
