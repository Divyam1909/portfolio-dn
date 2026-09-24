import {
  WebGLRenderer, Scene, PerspectiveCamera, BufferGeometry, BufferAttribute,
  ShaderMaterial, Points, AdditiveBlending, Group, MathUtils,
} from 'three'
import { SHAPES, SPIN, rng } from './shapes.js'

const hex = (h) => {
  const n = parseInt(h.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

// Ashima 3D simplex noise (MIT)
const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`

const VERT = /* glsl */ `
attribute vec3 aS0; attribute vec3 aS1; attribute vec3 aS2; attribute vec3 aS3;
attribute vec3 aS4; attribute vec3 aS5; attribute vec3 aS6; attribute vec3 aS7;
attribute vec4 aRnd;

uniform float uTime, uMorph, uScatter, uSize, uPR, uDim, uSpin, uPulseT, uMouseF;
uniform vec3 uMouse, uPulseO, uColA, uColB, uColC;

varying vec3 vColor;
varying float vAlpha;

${NOISE}

#define PI 3.14159265

vec3 shapeAt(int i){
  if(i==0) return aS0; if(i==1) return aS1; if(i==2) return aS2; if(i==3) return aS3;
  if(i==4) return aS4; if(i==5) return aS5; if(i==6) return aS6; return aS7;
}
float spinW(int i){ return (i==0||i==6||i==7) ? 1. : 0.; }
vec3 rotY(vec3 p, float a){ float c=cos(a), s=sin(a); return vec3(p.x*c+p.z*s, p.y, -p.x*s+p.z*c); }

void main(){
  int i0 = int(floor(uMorph));
  int i1 = min(i0 + 1, 7);
  float f = uMorph - float(i0);
  float st = aRnd.y * 0.45;
  float fl = smoothstep(st, st + 0.55, f);

  vec3 a = rotY(shapeAt(i0), uSpin * spinW(i0));
  vec3 b = rotY(shapeAt(i1), uSpin * spinW(i1));
  vec3 p = mix(a, b, fl);

  // mid-transition: particles swirl and scatter, then settle into the next shape
  float tr = sin(fl * PI);
  p = rotY(p, tr * (aRnd.x - 0.5) * 1.6);
  float t = uTime * 0.22;
  vec3 q = p * 0.75 + aRnd.xyz;
  vec3 n = vec3(snoise(q + t), snoise(q + t + 17.1), snoise(q + t + 31.7));
  p += n * (0.025 + tr * (0.25 + aRnd.x * 0.6) + uScatter * (0.5 + aRnd.z));

  vec4 wp = modelMatrix * vec4(p, 1.0);

  // cursor repulsion (world-space, on the z=0 plane)
  vec2 d = wp.xy - uMouse.xy;
  float dist = length(d);
  float force = smoothstep(0.85, 0.0, dist) * uMouseF;
  wp.xy += normalize(d + 1e-4) * force * 0.55;
  wp.z += force * 0.4;

  // click / tap shockwave
  float pd = length(wp.xyz - uPulseO);
  float ring = exp(-pow((pd - uPulseT * 4.5) * 2.6, 2.)) * exp(-uPulseT * 1.6);
  wp.xyz += normalize(wp.xyz - uPulseO + 1e-4) * ring * 0.45;

  vec4 mv = viewMatrix * wp;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (0.45 + aRnd.z) * uPR * (1.0 / -mv.z) * (1.0 + ring * 1.5);

  vec3 col = aRnd.w > 0.84 ? uColB : (aRnd.w > 0.78 ? uColC : uColA);
  vColor = mix(col, uColB, clamp(force * 1.2 + ring, 0., 1.));
  vAlpha = uDim * (0.35 + 0.55 * aRnd.z) * (1.0 + force * 0.8);
}`

const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = pow(1.0 - d * 2.0, 1.7);
  gl_FragColor = vec4(vColor, a * vAlpha);
}`

const DUST_VERT = /* glsl */ `
attribute vec4 aRnd;
uniform float uTime, uPR, uScroll;
varying float vA;
void main(){
  vec3 p = position;
  p.y = mod(p.y + uTime * 0.04 * (0.3 + aRnd.x) + uScroll * (0.4 + aRnd.y * 0.8), 16.) - 8.;
  p.x += sin(uTime * 0.2 + aRnd.z * 6.28) * 0.15;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (6. + aRnd.w * 10.) * uPR / -mv.z;
  vA = 0.25 + aRnd.w * 0.4;
}`
const DUST_FRAG = /* glsl */ `
varying float vA;
void main(){
  float d = length(gl_PointCoord - .5);
  if (d > .5) discard;
  gl_FragColor = vec4(vec3(.93), (1. - d * 2.) * vA);
}`

export async function createScene(canvas, { onShapeChange, onProgress } = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const coarse = matchMedia('(pointer: coarse)').matches
  const small = Math.min(innerWidth, innerHeight) < 700
  const COUNT = coarse || small ? 9000 : 20000

  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' })
  renderer.setClearColor(0x000000, 0)
  const pr = Math.min(devicePixelRatio || 1, coarse ? 1.75 : 2)
  renderer.setPixelRatio(pr)

  const scene = new Scene()
  const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 100)
  camera.position.z = 7

  // ---- Shapes (wait for the display font so the monogram samples correctly)
  try {
    await Promise.race([
      document.fonts.load("italic 270px 'Instrument Serif'"),
      new Promise((r) => setTimeout(r, 2000)),
    ])
  } catch { /* fall back to system serif */ }

  const geo = new BufferGeometry()
  for (let i = 0; i < SHAPES.length; i++) {
    geo.setAttribute(`aS${i}`, new BufferAttribute(SHAPES[i](COUNT), 3))
    onProgress?.((i + 1) / SHAPES.length)
    await new Promise((r) => setTimeout(r, 0)) // yield so the loader can paint
  }
  const r = rng(5)
  const rnd = new Float32Array(COUNT * 4)
  for (let i = 0; i < rnd.length; i++) rnd[i] = r()
  geo.setAttribute('aRnd', new BufferAttribute(rnd, 4))
  geo.setAttribute('position', geo.getAttribute('aS0')) // for bounds only
  geo.boundingSphere = null

  const uniforms = {
    uTime: { value: 0 },
    uMorph: { value: 0 },
    uScatter: { value: 0 },
    uSize: { value: coarse ? 24 : 21 },
    uPR: { value: pr },
    uDim: { value: 1 },
    uSpin: { value: 0 },
    uPulseT: { value: 10 },
    uPulseO: { value: [0, 0, 0] },
    uMouse: { value: [99, 99, 0] },
    uMouseF: { value: 0 },
    uColA: { value: hex('#eceae3') },
    uColB: { value: hex('#c8ff4d') },
    uColC: { value: hex('#8fb3ff') },
  }
  const mat = new ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  })
  const points = new Points(geo, mat)
  points.frustumCulled = false
  const group = new Group()
  group.add(points)
  scene.add(group)

  // ---- Background dust
  const DUST = coarse ? 350 : 800
  const dGeo = new BufferGeometry()
  const dp = new Float32Array(DUST * 3)
  const dr = new Float32Array(DUST * 4)
  for (let i = 0; i < DUST; i++) {
    dp[i * 3] = (r() - 0.5) * 22
    dp[i * 3 + 1] = (r() - 0.5) * 16
    dp[i * 3 + 2] = -r() * 14 + 1
    for (let k = 0; k < 4; k++) dr[i * 4 + k] = r()
  }
  dGeo.setAttribute('position', new BufferAttribute(dp, 3))
  dGeo.setAttribute('aRnd', new BufferAttribute(dr, 4))
  const dUni = { uTime: { value: 0 }, uPR: { value: pr }, uScroll: { value: 0 } }
  const dust = new Points(dGeo, new ShaderMaterial({
    vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, uniforms: dUni,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  }))
  dust.frustumCulled = false
  scene.add(dust)

  // ---- Layout: map scroll position → morph / position / dim
  const anchors = [...document.querySelectorAll('[data-shape]')]
  let stops = []
  let halfH = 1, halfW = 1, mobile = false
  let lastW = 0, lastH = 0

  function resize(force) {
    const w = innerWidth, h = innerHeight
    // ignore small height changes from mobile browser chrome showing/hiding
    if (!force && w === lastW && Math.abs(h - lastH) < 120) { layout(); return }
    lastW = w; lastH = h
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    halfH = camera.position.z * Math.tan(MathUtils.degToRad(camera.fov / 2))
    halfW = halfH * camera.aspect
    mobile = w < 900
    layout()
  }

  function layout() {
    const vh = innerHeight
    stops = anchors.map((el, i) => {
      const top = el.getBoundingClientRect().top + scrollY
      const dx = parseFloat(el.dataset.x || '0')
      return {
        shape: +el.dataset.shape,
        label: el.dataset.label || '',
        top,
        x: mobile ? 0 : dx,
        y: el.dataset.y ? parseFloat(el.dataset.y) : i === 0 ? (mobile ? 0.5 : 0.1) : 0,
        dim: mobile ? (i === 0 ? 0.85 : 0.3) : parseFloat(el.dataset.dim || '1'),
      }
    })
    // transition k happens around the moment anchor k+1 reaches the middle of the viewport
    for (let k = 0; k < stops.length - 1; k++) {
      const b = stops[k + 1].top - vh * 0.55
      const gap = stops[k + 1].top - stops[k].top
      stops[k].b = b
      stops[k].T = Math.max(40, Math.min(vh * 0.32, gap * 0.45))
    }
  }

  const smooth = (e0, e1, x) => { const t = MathUtils.clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t) }

  function sample(y) {
    const s0 = stops[0]
    let morph = s0.shape, x = s0.x, yy = s0.y, dim = s0.dim
    for (let k = 0; k < stops.length - 1; k++) {
      const a = stops[k], b = stops[k + 1]
      const s = smooth(a.b - a.T, a.b + a.T, y)
      morph += (b.shape - a.shape) * s
      x += (b.x - a.x) * s
      yy += (b.y - a.y) * s
      dim += (b.dim - a.dim) * s
    }
    return { morph, x, y: yy, dim }
  }

  resize(true)
  addEventListener('resize', () => resize(false))
  new ResizeObserver(() => layout()).observe(document.body)

  // ---- Pointer
  const mouse = { x: 0, y: 0, active: false, last: 0 }
  const tilt = { x: 0, y: 0 }
  addEventListener('pointermove', (e) => {
    mouse.x = (e.clientX / innerWidth) * 2 - 1
    mouse.y = -(e.clientY / innerHeight) * 2 + 1
    mouse.active = true
    mouse.last = performance.now()
  }, { passive: true })
  document.addEventListener('pointerleave', () => { mouse.active = false })
  addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') mouse.active = false })
  addEventListener('pointerdown', (e) => {
    if (e.target.closest('a, button, input, textarea, select, label')) return
    const x = ((e.clientX / innerWidth) * 2 - 1) * halfW
    const y = (-(e.clientY / innerHeight) * 2 + 1) * halfH
    uniforms.uPulseO.value = [x, y, 0]
    uniforms.uPulseT.value = 0
  })

  // ---- Loop
  let current = { morph: 0, x: stops[0].x, y: stops[0].y, dim: stops[0].dim }
  let lastScroll = scrollY
  let shownShape = -1
  let prev = performance.now()
  let time = 0, spin = 0

  function frame(now) {
    const dt = Math.min((now - prev) / 1000, 0.05)
    prev = now
    const still = reduced.matches

    const y = scrollY
    const vel = (y - lastScroll) / Math.max(dt, 1e-3)
    lastScroll = y

    const target = sample(y)
    const k = still ? 1 : 1 - Math.exp(-dt * 5)
    current.morph += (target.morph - current.morph) * k
    current.x += (target.x - current.x) * k
    current.y += (target.y - current.y) * k
    current.dim += (target.dim - current.dim) * k

    if (!still) { time += dt; spin += dt * 0.12 }

    const scale = MathUtils.clamp((halfW * 0.56) / 2.2, mobile ? 0.42 : 0.48, 0.92)
    group.scale.setScalar(scale)
    group.position.set(current.x * halfW, current.y * halfH, 0)

    const tx = still ? 0 : mouse.y * -0.22
    const ty = still ? 0 : mouse.x * 0.35 + Math.sin(time * 0.3) * 0.12
    tilt.x += (tx - tilt.x) * (1 - Math.exp(-dt * 3))
    tilt.y += (ty - tilt.y) * (1 - Math.exp(-dt * 3))
    group.rotation.set(tilt.x, tilt.y, 0)

    uniforms.uTime.value = time
    uniforms.uSpin.value = spin
    uniforms.uMorph.value = MathUtils.clamp(current.morph, 0, 7)
    uniforms.uDim.value = current.dim
    const scatterT = still ? 0 : Math.min(Math.abs(vel) * 0.00006, 0.18)
    uniforms.uScatter.value += (scatterT - uniforms.uScatter.value) * (1 - Math.exp(-dt * 4))
    uniforms.uMouse.value = [mouse.x * halfW, mouse.y * halfH, 0]
    // the cursor's influence fades when it rests, so shapes settle back and stay readable
    const mf = mouse.active && now - mouse.last < 1800 ? 1 : 0
    uniforms.uMouseF.value += (mf - uniforms.uMouseF.value) * (1 - Math.exp(-dt * 4))
    if (!still) uniforms.uPulseT.value += dt

    dUni.uTime.value = time
    dUni.uScroll.value = y / innerHeight

    const idx = Math.round(current.morph)
    if (idx !== shownShape) {
      shownShape = idx
      const s = stops.find((s) => s.shape === idx)
      onShapeChange?.(idx, stops.length, s ? s.label : '')
    }

    renderer.render(scene, camera)
  }
  renderer.setAnimationLoop(frame)

  return { layout, renderer }
}
