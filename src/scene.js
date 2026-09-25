import {
  WebGLRenderer, Scene, PerspectiveCamera, BufferGeometry, BufferAttribute, Float32BufferAttribute,
  ShaderMaterial, Points, LineSegments, Line, Mesh, RingGeometry, CircleGeometry, LineBasicMaterial,
  MeshBasicMaterial, AdditiveBlending, Group, MathUtils, Vector2, Vector3, Color, DoubleSide,
  LinearSRGBColorSpace, PlaneGeometry,
} from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { SHAPES, rng, LEAF_BASE, BOOK, LATTICE_NODES, latLon, arcPoint, HOME, GLOBE_R, HELIX, HELIX_BEADS, RING_TILTS } from './shapes.js'

const PI = Math.PI
const DEG = PI / 180
const JOURNEY = 8 // shapes 0..7 are the journey; shape 8 is the hidden one
const GLOBE_TILT = HOME.lat * DEG - 0.45 // brings home (Thane) up towards the visible top of the globe

const hex = (h) => {
  const n = parseInt(h.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
// colours are authored in sRGB and passed through untouched (output colour space is linear)
const raw = (h) => new Color().setRGB(...hex(h), LinearSRGBColorSpace)
const ACCENT = '#c8ff4d'

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

const ROT = /* glsl */ `
vec3 rotX(vec3 p, float a){ float c=cos(a), s=sin(a); return vec3(p.x, p.y*c-p.z*s, p.y*s+p.z*c); }
vec3 rotY(vec3 p, float a){ float c=cos(a), s=sin(a); return vec3(p.x*c+p.z*s, p.y, -p.x*s+p.z*c); }
vec3 rotZ(vec3 p, float a){ float c=cos(a), s=sin(a); return vec3(p.x*c-p.y*s, p.x*s+p.y*c, p.z); }`

const VERT = /* glsl */ `
attribute vec3 aS0; attribute vec3 aS1; attribute vec3 aS2; attribute vec3 aS3; attribute vec3 aS4;
attribute vec3 aS5; attribute vec3 aS6; attribute vec3 aS7;
attribute vec4 aRnd;
attribute vec4 aOrder;
attribute vec4 aOrder2;

uniform float uTime, uMorph, uScatter, uSize, uPR, uDim, uSpin, uSpinG, uPulseT, uMouseF, uScale;
uniform float uIntro, uLive3, uLive4, uLive5, uFocusAmt, uMouseR, uGain, uActiveRole, uFocusGroup, uRelN;
uniform vec3 uRel[8];
uniform vec3 uMouse, uPulseO, uColA, uColB, uColC, uFocus, uLeafBase;
uniform vec3 uSt[8];
uniform vec3 uBead[3];
uniform vec2 uTilt;

varying vec3 vColor;
varying float vAlpha;

#define PI 3.14159265
${NOISE}
${ROT}

vec3 shapeAt(int i){
  if(i==0) return aS0; if(i==1) return aS1; if(i==2) return aS2; if(i==3) return aS3;
  if(i==4) return aS4; if(i==5) return aS5; if(i==6) return aS6; return aS7;
}

// Mirrors bookPage() in shapes.js for the right-hand page, turned by angle a around the spine.
vec3 turnedPage(float u, float v, float a){
  float lift = ${BOOK.LIFT.toFixed(3)} * sin(min(1., u) * PI * 0.62);
  float d = 0.03 + u * ${BOOK.W.toFixed(3)};
  a -= sin(a) * 0.35 * u;
  vec3 p = vec3(d * cos(a), v * ${BOOK.H.toFixed(3)}, lift + d * sin(a) * 0.95);
  return rotZ(rotY(rotX(p, ${BOOK.ROT[0].toFixed(3)}), ${BOOK.ROT[1].toFixed(3)}), ${BOOK.ROT[2].toFixed(3)});
}

vec3 helixTilt(vec3 p){ return rotZ(rotY(rotX(p, ${HELIX.ROT[0].toFixed(3)}), ${HELIX.ROT[1].toFixed(3)}), ${HELIX.ROT[2].toFixed(3)}); }
vec3 ringTilt(vec3 p, int g){
  ${RING_TILTS.map((r, g) => `if(g==${g}) return rotZ(rotY(rotX(p, ${r[0].toFixed(2)}), ${r[1].toFixed(2)}), ${r[2].toFixed(2)});`).join('\n  ')}
  return p;
}

// Per-shape behaviour: spinning, the internship beads, skill rings and the "living" project scenes.
vec3 living(int i, vec3 p, inout float alpha, inout float glow){
  if(i==0) return rotY(p, uSpin);
  if(i==2){
    if(aOrder2.x >= 0.){
      // data packets flowing along the strands
      float strand = floor(aOrder2.x * 0.5);
      float t = fract(aOrder2.x - strand * 2. + uTime * 0.045);
      float a = t * ${HELIX.TURNS.toFixed(2)} * 6.2831853 + strand * PI;
      p = helixTilt(vec3(t * ${(2 * HELIX.L).toFixed(3)} - ${HELIX.L.toFixed(3)}, cos(a) * ${(HELIX.R * 1.22).toFixed(3)}, sin(a) * ${(HELIX.R * 1.22).toFixed(3)}));
      glow += 0.35;
    }
    if(aOrder2.y >= 0.){
      // internship beads: the one you're reading about swells and glows
      vec3 c = uBead[int(aOrder2.y + 0.5)];
      float on = 1. - step(0.5, abs(aOrder2.y - uActiveRole));
      float pulse = 0.5 + 0.5 * sin(uTime * 3.2);
      p = c + (p - c) * (1. + on * (0.45 + 0.2 * pulse));
      glow += on * (0.8 + 0.4 * pulse);
      alpha *= 0.55 + on * 0.6;
    }
    return p;
  }
  if(i==6){
    if(aOrder2.z >= 0.){
      // one orbit ring per skill group; the focused group's ring speeds up and lights
      int g = int(aOrder2.z + 0.5);
      float on = 1. - step(0.5, abs(aOrder2.z - uFocusGroup));
      float a = aOrder2.w * 6.2831853 + uTime * (0.22 + aOrder2.z * 0.06 + on * 0.9) * (mod(aOrder2.z, 2.) < 0.5 ? 1. : -1.);
      float rad = 1.75 + aOrder2.z * 0.12;
      p = ringTilt(vec3(cos(a) * rad, (aRnd.x - 0.5) * 0.03, sin(a) * rad), g);
      glow += on * uFocusAmt * 1.2;
      alpha *= 0.7 + on * uFocusAmt * 0.8;
    }
    return rotY(p, uSpin);
  }
  if(i==7) return rotX(rotY(p, uSpinG), ${GLOBE_TILT.toFixed(4)});
  if(i==3){
    // candles draw in left → right; the future is still noise
    float hidden = smoothstep(uLive3 - 0.02, uLive3 + 0.1, aOrder.x);
    p += hidden * (vec3(0.35, 0., 0.) + (aRnd.xyz - 0.5) * vec3(0.8, 2.4, 1.4));
    alpha *= 1. - hidden * 0.8;
  }
  if(i==4){
    // the leaf grows out of its stem
    vec3 b = uLeafBase;
    p = b + (p - b) * (0.3 + 0.7 * uLive4);
    float hidden = smoothstep(uLive4 - 0.04, uLive4 + 0.04, aOrder.y);
    p = mix(p, b + (p - b) * 0.08, hidden);
    alpha *= 1. - hidden * 0.85;
  }
  if(i==5 && aOrder.z >= 0.){
    // loose pages turn one after another
    float page = floor(aOrder.z * 0.5);
    float u = aOrder.z - page * 2.;
    float t = clamp(uLive5 * 3.4 - page * 1.1, 0., 1.);
    p = turnedPage(u, aOrder.w, t * t * (3. - 2. * t) * PI);
  }
  return p;
}

void main(){
  int i0 = int(floor(uMorph));
  int i1 = min(i0 + 1, 7);
  float f = uMorph - float(i0);
  float st = aRnd.y * 0.45;
  float fl = smoothstep(st, st + 0.55, f);

  float alA = 1., alB = 1., glA = 0., glB = 0.;
  vec3 a = living(i0, shapeAt(i0), alA, glA);
  vec3 b = living(i1, shapeAt(i1), alB, glB);
  vec3 p = mix(a, b, fl);
  float alpha = mix(alA, alB, fl);
  float glow = mix(glA, glB, fl);
  float tr = sin(fl * PI);

  // skills constellation: light up particles around the focused node
  float w6 = (i0 == 6 ? 1. - fl : 0.) + (i1 == 6 ? fl : 0.);
  float near = smoothstep(0.42, 0.0, distance(aS6, uFocus));
  for (int k = 0; k < 8; k++) {
    if (float(k) >= uRelN) break;
    near = max(near, 0.55 * smoothstep(0.3, 0.0, distance(aS6, uRel[k])));
  }
  float focus = w6 * uFocusAmt * near;

  // mid-flight: particles swirl and scatter, then settle into the next shape
  p = rotY(p, tr * (aRnd.x - 0.5) * 1.6);
  float t = uTime * 0.22;
  vec3 q = p * 0.75 + aRnd.xyz;
  vec3 n = vec3(snoise(q + t), snoise(q + t + 17.1), snoise(q + t + 31.7));
  p += n * (0.025 + tr * (0.35 + aRnd.x * 0.8) + uScatter * (0.5 + aRnd.z));

  // big bang: everything starts flung across space
  vec3 chaos = normalize(aRnd.xyz - 0.5 + 1e-3) * (3. + aRnd.w * 16.);
  p = mix(p, chaos + n * 2., uIntro);

  p = rotX(rotY(p, uTilt.y), uTilt.x) * uScale;
  vec3 station = mix(uSt[i0], uSt[i1], fl);
  vec4 wp = vec4(p + station, 1.0);

  // globe: fade the far hemisphere so the continents read clearly
  float w7 = ((i0 == 7 ? 1. - fl : 0.) + (i1 == 7 ? fl : 0.));
  float facing = dot(normalize(p), normalize(cameraPosition - wp.xyz));
  alpha *= mix(1., 0.12 + 0.88 * smoothstep(-0.25, 0.3, facing), w7);

  // cursor repulsion
  vec2 d = wp.xy - uMouse.xy;
  float force = smoothstep(uMouseR, 0.0, length(d)) * uMouseF * (1. - uIntro);
  wp.xy += normalize(d + 1e-4) * force * 0.55;
  wp.z += force * 0.4;

  // click / tap shockwave
  float pd = length(wp.xyz - uPulseO);
  float ring = exp(-pow((pd - uPulseT * 4.5) * 2.6, 2.)) * exp(-uPulseT * 1.6);
  wp.xyz += normalize(wp.xyz - uPulseO + 1e-4) * ring * 0.45;

  vec4 mv = viewMatrix * wp;
  gl_Position = projectionMatrix * mv;
  float depth = -mv.z;
  float size = uSize * (0.45 + aRnd.z) * uPR / max(depth, 0.1) * (1. + ring * 1.5 + focus * 1.4 + glow * 0.7);
  gl_PointSize = min(size, 48. * uPR);

  vec3 col = aRnd.w > 0.84 ? uColB : (aRnd.w > 0.78 ? uColC : uColA);
  vColor = mix(col, uColB, clamp(force * 1.2 + ring + focus + glow, 0., 1.));
  float dimOthers = 1. - uFocusAmt * w6 * 0.45 * (1. - focus);
  vAlpha = uGain * uDim * alpha * dimOthers * (0.35 + 0.55 * aRnd.z) * (1. + force * 0.8 + focus + glow * 0.6)
         * smoothstep(0.3, 2.2, depth);
}`

const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  gl_FragColor = vec4(vColor, pow(1.0 - d * 2.0, 1.7) * vAlpha);
}`

const DUST_VERT = /* glsl */ `
attribute vec4 aRnd;
uniform float uTime, uPR;
varying float vA;
void main(){
  vec3 p = position;
  p.x += sin(uTime * 0.2 + aRnd.z * 6.28) * 0.2;
  p.y += cos(uTime * 0.17 + aRnd.x * 6.28) * 0.2;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  float depth = -mv.z;
  gl_PointSize = min((8. + aRnd.w * 14.) * uPR / max(depth, 0.1), 6. * uPR);
  vA = (0.2 + aRnd.w * 0.45) * smoothstep(0.5, 3., depth) * smoothstep(70., 20., depth);
}`
const DUST_FRAG = /* glsl */ `
varying float vA;
void main(){
  float d = length(gl_PointCoord - .5);
  if (d > .5) discard;
  gl_FragColor = vec4(vec3(.93), (1. - d * 2.) * vA);
}`
const WARP_VERT = /* glsl */ `
attribute float aEnd;
uniform float uWarp;
varying float vA;
void main(){
  vec3 p = position;
  p.z += aEnd * uWarp * 2.2;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  vA = (1. - aEnd) * clamp(uWarp * 0.35, 0., 0.55) * smoothstep(1., 4., -mv.z) * smoothstep(60., 15., -mv.z);
}`
const WARP_FRAG = /* glsl */ `
varying float vA;
void main(){ gl_FragColor = vec4(vec3(0.85, 0.95, 1.), vA); }`

// Chromatic aberration + slice glitch + vignette, driven by flight intensity
const GlitchShader = {
  uniforms: { tDiffuse: { value: null }, uAmount: { value: 0 }, uTime: { value: 0 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uAmount, uTime; varying vec2 vUv;
    float hash(float n){ return fract(sin(n) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      float a = uAmount;
      float n = hash(floor(uv.y * 26.) + floor(uTime * 16.) * 7.13);
      uv.x += (n - 0.5) * 0.045 * a * step(0.9, n) * step(0.35, a);
      vec2 dir = uv - 0.5;
      float ca = 0.0012 + 0.009 * a;
      vec3 col = vec3(texture2D(tDiffuse, uv + dir * ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - dir * ca).b);
      col *= 1. - dot(dir, dir) * 0.55;
      gl_FragColor = vec4(col, 1.);
    }`,
}

// Nebula fog: soft noise clouds on camera-facing quads placed along the route.
const FOG_VERT = /* glsl */ `
uniform float uSize, uRot;
varying vec2 vUv;
varying float vFade;
void main(){
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(0., 0., 0., 1.);
  float c = cos(uRot), s = sin(uRot);
  mv.xy += mat2(c, s, -s, c) * position.xy * uSize;
  float depth = -mv.z;
  vFade = smoothstep(0.6, 8., depth) * smoothstep(90., 34., depth);
  gl_Position = projectionMatrix * mv;
}`
const FOG_FRAG = /* glsl */ `
uniform float uTime, uSeed, uAlpha;
uniform vec3 uColA, uColB;
varying vec2 vUv;
varying float vFade;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0., a = 0.5;
  for (int i = 0; i < OCTAVES; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}
void main(){
  if (vFade < 0.002) discard;
  vec2 c = vUv - 0.5;
  float fall = smoothstep(0.5, 0.08, length(c));
  vec2 q = c * 2.4 + uSeed;
  float n = fbm(q + vec2(uTime * 0.018, -uTime * 0.013));
  float m = fbm(q * 1.6 + n * 1.8 - uTime * 0.01);
  float d = smoothstep(0.32, 0.92, m) * fall;
  gl_FragColor = vec4(mix(uColA, uColB, n), d * uAlpha * vFade);
}`
// one colour pair per chapter station
const FOG_COLORS = [
  ['#3b5bff', '#c8ff4d'], ['#7a3cff', '#3b5bff'], ['#11b5a0', '#3b5bff'], ['#c8ff4d', '#11b5a0'],
  ['#3ddc84', '#c8ff4d'], ['#ff9d3c', '#ff4d6d'], ['#8f5bff', '#ff4d6d'], ['#2f7bff', '#11b5a0'],
]

const TIERS = [
  { count: 10000, pr: 1.5, bloom: false, post: false },
  { count: 16000, pr: 1.75, bloom: true, post: true },
  { count: 20000, pr: 2, bloom: true, post: true },
]

export async function createScene(canvas, opts = {}) {
  const { onShapeChange, onProgress, onFrame, onPulse, labels = {} } = opts
  const reducedMQ = matchMedia('(prefers-reduced-motion: reduce)')
  const coarse = matchMedia('(pointer: coarse)').matches
  const cores = navigator.hardwareConcurrency || 4
  const mem = navigator.deviceMemory || 4
  let tier = coarse || innerWidth < 900 ? (cores >= 6 && mem >= 4 ? 1 : 0) : cores <= 4 ? 1 : 2
  const forced = new URLSearchParams(location.search).get('quality')
  if (forced !== null && TIERS[+forced]) tier = +forced
  const MAX = TIERS[tier].count

  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' })
  renderer.outputColorSpace = LinearSRGBColorSpace
  renderer.setClearColor(raw('#09090b'), 1)

  const scene = new Scene()
  const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 200)
  camera.position.set(0, 0, 7)

  // ---- Shapes (wait for the display font so text shapes sample correctly)
  try {
    await Promise.race([document.fonts.load("italic 270px 'Instrument Serif'"), new Promise((r) => setTimeout(r, 2000))])
  } catch { /* fall back to system serif */ }

  const geo = new BufferGeometry()
  const order = new Float32Array(MAX * 4).fill(-1)
  const order2 = new Float32Array(MAX * 4).fill(-1)
  for (let i = 0; i < SHAPES.length; i++) {
    const s = SHAPES[i](MAX)
    geo.setAttribute(`aS${i}`, new BufferAttribute(s.pos, 3))
    // each shape owns different channels of the shared per-particle data
    const o = s.order
    if (i === 3) for (let k = 0; k < MAX; k++) order[k * 4] = o[k * 8]
    if (i === 4) for (let k = 0; k < MAX; k++) order[k * 4 + 1] = o[k * 8 + 1]
    if (i === 5) for (let k = 0; k < MAX; k++) { order[k * 4 + 2] = o[k * 8 + 2]; order[k * 4 + 3] = o[k * 8 + 3] }
    if (i === 2) for (let k = 0; k < MAX; k++) { order2[k * 4] = o[k * 8 + 4]; order2[k * 4 + 1] = o[k * 8 + 5] }
    if (i === 6) for (let k = 0; k < MAX; k++) { order2[k * 4 + 2] = o[k * 8 + 6]; order2[k * 4 + 3] = o[k * 8 + 7] }
    onProgress?.((i + 1) / SHAPES.length)
    await new Promise((r) => setTimeout(r, 0))
  }
  const r = rng(5)
  const rnd = new Float32Array(MAX * 4)
  for (let i = 0; i < rnd.length; i++) rnd[i] = r()
  geo.setAttribute('aRnd', new BufferAttribute(rnd, 4))
  geo.setAttribute('aOrder', new BufferAttribute(order, 4))
  geo.setAttribute('aOrder2', new BufferAttribute(order2, 4))
  geo.setAttribute('position', geo.getAttribute('aS0'))

  // Stations: each chapter lives at its own point in space; the camera flies between them.
  const D = 18
  const stations = Array.from({ length: JOURNEY }, (_, i) => new Vector3(Math.sin(i * 1.9) * 5, Math.cos(i * 1.3) * 2.2 - 2.2, -i * D))
  const flat = Array.from({ length: JOURNEY }, () => new Vector3())

  const uniforms = {
    uTime: { value: 0 }, uMorph: { value: 0 }, uScatter: { value: 0 },
    uSize: { value: coarse ? 26 : 21 }, uPR: { value: 1 }, uDim: { value: 1 }, uGain: { value: 1 },
    uSpin: { value: 0 }, uSpinG: { value: 0 }, uScale: { value: 1 },
    uPulseT: { value: 10 }, uPulseO: { value: new Vector3() },
    uMouse: { value: new Vector3(99, 99, 0) }, uMouseF: { value: 0 }, uMouseR: { value: 0.9 },
    uIntro: { value: reducedMQ.matches ? 0 : 1 },
    uLive3: { value: 1 }, uLive4: { value: 1 }, uLive5: { value: 0 },
    uFocus: { value: new Vector3() }, uFocusAmt: { value: 0 }, uFocusGroup: { value: -1 },
    uRel: { value: Array.from({ length: 8 }, () => new Vector3()) }, uRelN: { value: 0 },
    uActiveRole: { value: 0 }, uBead: { value: HELIX_BEADS.map((b) => new Vector3(...b)) },
    uLeafBase: { value: new Vector3(...LEAF_BASE) },
    uSt: { value: stations },
    uTilt: { value: new Vector2() },
    uColA: { value: hex('#eceae3') }, uColB: { value: hex(ACCENT) }, uColC: { value: hex('#8fb3ff') },
  }
  const points = new Points(geo, new ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  }))
  points.frustumCulled = false
  scene.add(points)

  // ---- Space dust along the whole route + warp streaks during flight
  const DUST = [500, 900, 1500][tier]
  const dp = new Float32Array(DUST * 3)
  const dr = new Float32Array(DUST * 4)
  for (let i = 0; i < DUST; i++) {
    dp.set([(r() - 0.5) * 34, (r() - 0.5) * 22, 14 - r() * (JOURNEY * D + 30)], i * 3)
    for (let k = 0; k < 4; k++) dr[i * 4 + k] = r()
  }
  const dGeo = new BufferGeometry()
  dGeo.setAttribute('position', new BufferAttribute(dp, 3))
  dGeo.setAttribute('aRnd', new BufferAttribute(dr, 4))
  const dUni = { uTime: { value: 0 }, uPR: { value: 1 } }
  const dust = new Points(dGeo, new ShaderMaterial({
    vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, uniforms: dUni,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  }))
  dust.frustumCulled = false
  scene.add(dust)

  const WARP = Math.min(DUST, 500)
  const wp = new Float32Array(WARP * 6)
  const we = new Float32Array(WARP * 2)
  for (let i = 0; i < WARP; i++) {
    wp.set([dp[i * 3], dp[i * 3 + 1], dp[i * 3 + 2], dp[i * 3], dp[i * 3 + 1], dp[i * 3 + 2]], i * 6)
    we[i * 2 + 1] = 1
  }
  const wGeo = new BufferGeometry()
  wGeo.setAttribute('position', new BufferAttribute(wp, 3))
  wGeo.setAttribute('aEnd', new BufferAttribute(we, 1))
  const wUni = { uWarp: { value: 0 } }
  const warp = new LineSegments(wGeo, new ShaderMaterial({
    vertexShader: WARP_VERT, fragmentShader: WARP_FRAG, uniforms: wUni,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  }))
  warp.frustumCulled = false
  scene.add(warp)

  // ---- Nebula fog along the route
  const fogPlanes = []
  const fogGeo = new PlaneGeometry(1, 1)
  const fogOct = [3, 4, 4][tier]
  stations.forEach((st, i) => {
    for (let k = 0; k < 3; k++) {
      const u = {
        uTime: { value: 0 }, uSeed: { value: r() * 50 }, uAlpha: { value: (0.1 + r() * 0.06) * (coarse ? 0.65 : 1) },
        uSize: { value: 15 + r() * 12 }, uRot: { value: r() * PI * 2 },
        uColA: { value: hex(FOG_COLORS[i][k % 2]) }, uColB: { value: hex(FOG_COLORS[i][(k + 1) % 2]) },
      }
      const m = new Mesh(fogGeo, new ShaderMaterial({
        vertexShader: FOG_VERT, fragmentShader: FOG_FRAG, uniforms: u, defines: { OCTAVES: fogOct },
        transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
      }))
      m.position.set(st.x + (r() - 0.5) * 12, st.y + (r() - 0.5) * 6, st.z - 4 - k * 3.5 - r() * 2)
      m.frustumCulled = false
      m.renderOrder = -1
      m.userData.k = k
      scene.add(m)
      fogPlanes.push(m)
    }
  })

  // ---- Rigs: objects that ride along with a shape (same station, scale, tilt and spin)
  const makeRig = (i) => { const outer = new Group(); const inner = new Group(); outer.add(inner); scene.add(outer); return { i, outer, inner } }
  const latticeRig = makeRig(6)
  const helixRig = makeRig(2)
  const beadLocal = HELIX_BEADS.map((b) => new Vector3(...b).add(new Vector3(0, 0.34, 0)))
  const globeRig = makeRig(7)

  // Skill constellation lines
  const MAXSEG = 16
  const cGeo = new BufferGeometry()
  cGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(MAXSEG * 6), 3))
  cGeo.setDrawRange(0, 0)
  const cMat = new LineBasicMaterial({ color: raw(ACCENT), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false })
  latticeRig.inner.add(new LineSegments(cGeo, cMat))
  let focusTarget = 0
  const stopsShape6Near = () => Math.abs(uniforms.uMorph.value - 6) < 0.6

  const BEAM = 26
  const beamGeo = new BufferGeometry()
  beamGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(8 * BEAM * 3), 3))
  const beamT = new Float32Array(8 * BEAM)
  for (let q = 0; q < beamT.length; q++) beamT[q] = (q % BEAM) / (BEAM - 1)
  beamGeo.setAttribute('aT', new BufferAttribute(beamT, 1))
  beamGeo.setDrawRange(0, 0)
  const beamUni = { uTime: { value: 0 }, uAlpha: { value: 0 }, uPR: { value: 1 } }
  const beams = new Points(beamGeo, new ShaderMaterial({
    uniforms: beamUni, transparent: true, depthWrite: false, blending: AdditiveBlending,
    vertexShader: `attribute float aT; uniform float uTime, uPR; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv;
        float dash = fract(aT * 2.5 - uTime * 1.2); vA = smoothstep(0., 0.15, dash) * smoothstep(0.6, 0.2, dash);
        gl_PointSize = (2.5 + vA * 5.) * uPR * 6. / max(-mv.z, .1); }`,
    fragmentShader: `uniform float uAlpha; varying float vA;
      void main(){ float d = length(gl_PointCoord - .5); if (d > .5) discard;
        gl_FragColor = vec4(${hex(ACCENT).join(',')}, (1. - d * 2.) * (0.25 + vA) * uAlpha); }`,
  }))
  beams.frustumCulled = false
  latticeRig.inner.add(beams)
  const focusNode = new Vector3()

  // Globe: home pin, pulse ring, visitor pin and the arc between them
  const pinMat = new MeshBasicMaterial({ color: raw(ACCENT), transparent: true, side: DoubleSide, depthWrite: false })
  const ringMat = pinMat.clone()
  const Z = new Vector3(0, 0, 1)
  const place = (mesh, lat, lon, lift = 1.012) => {
    const n = new Vector3(...latLon(lat, lon, 1))
    mesh.position.copy(n).multiplyScalar(GLOBE_R * lift)
    mesh.quaternion.setFromUnitVectors(Z, n)
    globeRig.inner.add(mesh)
    return n
  }
  const homePin = new Mesh(new CircleGeometry(0.045, 20), pinMat)
  const homeRing = new Mesh(new RingGeometry(0.06, 0.08, 32), ringMat)
  const homeN = place(homePin, HOME.lat, HOME.lon)
  place(homeRing, HOME.lat, HOME.lon)
  let visitor = null
  const visitorPin = new Mesh(new CircleGeometry(0.035, 16), new MeshBasicMaterial({ color: raw('#ffffff'), transparent: true, side: DoubleSide, depthWrite: false }))
  const arcGeo = new BufferGeometry()
  const ARC = 72
  const arcMat = new LineBasicMaterial({ color: raw(ACCENT), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false })
  const arcLine = new Line(arcGeo, arcMat)
  globeRig.inner.add(arcLine)
  let visitorN = null

  function setVisitor(v) {
    visitor = v
    if (!v) return
    visitorN = place(visitorPin, v.lat, v.lon)
    const a = latLon(HOME.lat, HOME.lon, 1), b = latLon(v.lat, v.lon, 1)
    const pts = []
    for (let i = 0; i <= ARC; i++) pts.push(...arcPoint(a, b, i / ARC, 0.18 + 0.25 * Math.min(1, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]))))
    arcGeo.setAttribute('position', new Float32BufferAttribute(pts, 3))
    arcGeo.setDrawRange(0, 0)
  }

  // ---- Post-processing
  let composer = null, bloom = null, glitch = null
  function buildPost() {
    composer?.dispose?.()
    composer = null
    if (!TIERS[tier].post) return
    composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    // bloom smears dense shapes into blobs on small screens, so phones skip it
    if (TIERS[tier].bloom && !coarse) {
      bloom = new UnrealBloomPass(new Vector2(innerWidth, innerHeight), 0.35, 0.5, 0.32)
      composer.addPass(bloom)
    }
    glitch = new ShaderPass(GlitchShader)
    composer.addPass(glitch)
    composer.setPixelRatio(renderer.getPixelRatio())
    composer.setSize(innerWidth, innerHeight)
  }

  function applyTier() {
    const t = TIERS[tier]
    const pr = Math.min(devicePixelRatio || 1, t.pr)
    renderer.setPixelRatio(pr)
    uniforms.uPR.value = dUni.uPR.value = beamUni.uPR.value = pr
    geo.setDrawRange(0, Math.min(MAX, t.count))
    fogPlanes.forEach((m) => (m.visible = m.userData.k <= tier))
    // fewer particles → slightly bigger ones so shapes keep their density
    uniforms.uSize.value = (coarse ? 26 : 21) * Math.sqrt(20000 / Math.min(MAX, t.count)) ** 0.5
    // without bloom the particles need more light of their own (mostly phones)
    const count = Math.min(MAX, t.count)
    uniforms.uGain.value = coarse ? 1.5 * Math.sqrt(10000 / count) : t.bloom ? 1 : 1.3
    renderer.setSize(innerWidth, innerHeight, false)
    buildPost()
  }

  // ---- Layout: scroll position → journey value, camera framing, living-scene progress
  const anchors = [...document.querySelectorAll('[data-shape]')]
  let stops = []
  let halfH = 1, halfW = 1, mobile = false, maxScroll = 1
  let lastW = 0, lastH = 0

  function resize(force) {
    const w = innerWidth, h = innerHeight
    if (!force && w === lastW && Math.abs(h - lastH) < 120) { layout(); return }
    lastW = w; lastH = h
    renderer.setSize(w, h, false)
    composer?.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    halfH = 7 * Math.tan(MathUtils.degToRad(20))
    halfW = halfH * camera.aspect
    mobile = w < 900
    layout()
  }

  function layout() {
    const vh = innerHeight
    maxScroll = Math.max(1, document.documentElement.scrollHeight - vh)
    stops = anchors.map((el, i) => {
      const top = el.getBoundingClientRect().top + scrollY
      const stage = mobile && i > 0 && !el.matches('.contact') ? parseFloat(getComputedStyle(el).paddingTop) || 0 : 0
      const see = el.classList.contains('section--see-through')
      return {
        el, top, stage, see,
        shape: +el.dataset.shape,
        label: el.dataset.label || '',
        chapter: el.dataset.chapter || '',
        x: mobile ? 0 : parseFloat(el.dataset.x || '0'),
        y: el.dataset.y ? parseFloat(el.dataset.y) : i === 0 ? (mobile ? 0.6 : 0.1) : 0,
        dim: mobile ? (see ? 0.8 : 1) : parseFloat(el.dataset.dim || '1'),
      }
    })
    for (let k = 0; k < stops.length - 1; k++) {
      const gap = stops[k + 1].top - stops[k].top
      // fly while the story line (interlude) before the next chapter sits mid-screen
      const il = interludeBefore(stops[k + 1].el)
      if (il) {
        const r = il.getBoundingClientRect()
        stops[k].b = r.top + scrollY + r.height / 2 - vh / 2
        stops[k].T = Math.min(r.height * 0.42, vh * 0.34)
      } else {
        stops[k].b = stops[k + 1].top - vh * (mobile ? 0.75 : 0.55)
        stops[k].T = Math.max(40, Math.min(vh * 0.32, gap * 0.45))
      }
    }
  }

  function interludeBefore(el) {
    let prev = el.previousElementSibling
    if (el.matches('.project') && !prev?.matches('.project')) prev = el.parentElement.previousElementSibling
    return prev?.classList.contains('interlude') ? prev : null
  }

  const smooth = (e0, e1, x) => { const t = MathUtils.clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t) }

  // On phones the shape sits in the empty "stage" above each section's text and follows it up.
  function stopY(s, y) {
    if (!mobile || !s.stage) return s.y
    const vh = innerHeight
    // see-through sections keep the shape mid-screen, behind their (transparent) panel
    const yScreen = MathUtils.clamp(s.top - y + s.stage * 0.5, vh * (s.see ? 0.4 : 0.26), vh * 0.62)
    return 1 - (2 * yScreen) / vh
  }

  const target = { morph: 0, x: 0, y: 0, dim: 1 }
  function sample(y) {
    const s0 = stops[0]
    target.morph = s0.shape; target.x = s0.x; target.y = stopY(s0, y); target.dim = s0.dim
    for (let k = 0; k < stops.length - 1; k++) {
      const a = stops[k], b = stops[k + 1]
      const s = smooth(a.b - a.T, a.b + a.T, y)
      target.morph += (b.shape - a.shape) * s
      target.x += (b.x - a.x) * s
      target.y += (stopY(b, y) - stopY(a, y)) * s
      target.dim += (b.dim - a.dim) * s
    }
    return target
  }
  function hold(i, y) {
    const start = i === 0 ? 0 : stops[i - 1].b + stops[i - 1].T
    const end = i === stops.length - 1 ? maxScroll : stops[i].b - stops[i].T
    return end > start ? MathUtils.clamp((y - start) / (end - start), 0, 1) : 0.5
  }

  resize(true)
  applyTier()
  addEventListener('resize', () => resize(false))
  new ResizeObserver(() => layout()).observe(document.body)

  // ---- Pointer, gyro and drag
  const mouse = { x: 0, y: 0, active: false, last: 0 }
  const tilt = { x: 0, y: 0 }
  const gyro = { x: 0, y: 0, on: false }
  addEventListener('pointermove', (e) => {
    mouse.x = (e.clientX / innerWidth) * 2 - 1
    mouse.y = -(e.clientY / innerHeight) * 2 + 1
    mouse.active = true
    mouse.last = performance.now()
  }, { passive: true })
  document.addEventListener('pointerleave', () => { mouse.active = false })
  addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') mouse.active = false })

  const _v = new Vector3()
  const focusZ = { z: 0 }
  function screenToWorld(nx, ny, out) {
    _v.set(nx, ny, 0.5).unproject(camera).sub(camera.position).normalize()
    const t = Math.abs(_v.z) > 1e-4 ? (focusZ.z - camera.position.z) / _v.z : 7
    return out.copy(camera.position).addScaledVector(_v, t)
  }

  addEventListener('pointerdown', (e) => {
    if (e.target.closest('a, button, input, textarea, select, label, dialog, [data-no-pulse]')) return
    const nx = (e.clientX / innerWidth) * 2 - 1, ny = -(e.clientY / innerHeight) * 2 + 1
    screenToWorld(nx, ny, uniforms.uPulseO.value)
    uniforms.uPulseT.value = 0
    onPulse?.(nx, ny)
  })

  // Direct manipulation: while dragging, the lattice/globe follow the pointer 1:1; on release they coast.
  let spinVel = 0, gDrag = 0, dragging = false, dragTilt = 0, lastDrag = 0
  function drag(dxPx, dyPx) {
    const now = performance.now()
    const d = dxPx * 0.011
    spin += d; gDrag += d
    const dtm = Math.max(8, now - lastDrag) / 1000
    spinVel = MathUtils.clamp(d / dtm, -8, 8)
    lastDrag = now
    dragTilt = MathUtils.clamp(dragTilt + dyPx * 0.006, -0.7, 0.7)
  }

  // ---- Frame state
  const cur = { morph: 0, x: 0, y: 0, dim: 1, live3: 0.2, live4: 0.1, live5: 0 }
  let lastScroll = scrollY
  let shownShape = -1
  let prev = performance.now()
  let time = 0, spin = 0, flight = 0
  const camPos = new Vector3(), camLook = new Vector3()
  const A = { pos: new Vector3(), look: new Vector3() }, B = { pos: new Vector3(), look: new Vector3() }
  const off = new Vector3()
  let fpsFrames = 0, fpsTime = 0, fpsArmed = false
  let intro = null

  function pose(out, i, p, st, reduced) {
    const s = stops[i] || stops[0]
    const station = st[i]
    const angle = reduced ? 0 : (p - 0.5) * (mobile ? 0.22 : 0.36)
    // locating a skill pulls the camera a little closer to the constellation
    const dolly = (reduced ? 0 : (0.5 - p) * 0.8) - (i === 6 ? uniforms.uFocusAmt.value * 0.7 : 0)
    off.set(-s.x * halfW, -s._y * halfH, 0).applyAxisAngle(Y, angle)
    out.look.copy(station).add(off)
    off.set(-s.x * halfW, -s._y * halfH, 7 + dolly).applyAxisAngle(Y, angle)
    out.pos.copy(station).add(off)
  }
  const Y = new Vector3(0, 1, 0)

  function frame(now) {
    const dt = Math.min((now - prev) / 1000, 0.05)
    prev = now
    const reduced = reducedMQ.matches
    const y = scrollY
    const vel = (y - lastScroll) / Math.max(dt, 1e-3)
    lastScroll = y

    const tgt = sample(y)
    const k = reduced ? 1 : 1 - Math.exp(-dt * 4.5)
    cur.morph += (tgt.morph - cur.morph) * k
    cur.x += (tgt.x - cur.x) * k
    cur.dim += (tgt.dim - cur.dim) * k

    if (!reduced) time += dt
    if (!dragging) {
      if (focusTarget && stopsShape6Near()) {
        // locate: turn the lattice so the chosen skill faces you
        let want = -Math.atan2(focusNode.x, focusNode.z)
        want += Math.round((spin - want) / (PI * 2)) * PI * 2
        spin += (want - spin) * (1 - Math.exp(-dt * 3.5))
        spinVel = 0
      } else {
        if (!reduced) spin += dt * 0.12
        spin += spinVel * dt
        gDrag += spinVel * dt
      }
      spinVel *= Math.exp(-dt * 1.6)
      dragTilt *= Math.exp(-dt * 1.2)
    }

    const j = MathUtils.clamp(cur.morph, 0, JOURNEY - 1)
    const i0 = Math.floor(j), i1 = Math.min(i0 + 1, JOURNEY - 1), f = j - i0
    const st = reduced ? flat : stations
    uniforms.uSt.value = st

    // per-stop screen offsets (y can be dynamic on phones)
    for (let i = 0; i < stops.length; i++) stops[i]._y = stopY(stops[i], y)

    // camera: hold poses with a slow orbit, and a flight between them
    const p0 = hold(i0, y), p1 = hold(i1, y)
    pose(A, i0, p0, st, reduced)
    pose(B, i1, p1, st, reduced)
    const e = f * f * (3 - 2 * f)
    const arc = Math.sin(f * PI)
    camPos.lerpVectors(A.pos, B.pos, e)
    camLook.lerpVectors(A.look, B.look, Math.min(1, e * 1.25))
    if (!reduced) camPos.y += arc * 1.4
    flight = reduced ? 0 : arc
    const roll = flight * 0.16 * (i0 % 2 ? 1 : -1)
    camera.position.copy(camPos)
    camera.up.set(Math.sin(roll), Math.cos(roll), 0)
    camera.lookAt(camLook)
    const fov = 40 + flight * 14
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix() }
    focusZ.z = MathUtils.lerp(st[i0].z, st[i1].z, e)

    // cursor / gyro tilt
    const src = gyro.on ? gyro : mouse
    const tx = (reduced ? 0 : src.y * -0.22) + dragTilt
    const ty = reduced ? 0 : src.x * 0.35 + Math.sin(time * 0.3) * 0.12
    tilt.x += (tx - tilt.x) * (1 - Math.exp(-dt * 3))
    tilt.y += (ty - tilt.y) * (1 - Math.exp(-dt * 3))
    uniforms.uTilt.value.set(tilt.x, tilt.y)

    // phones: fill most of the stage width so the shapes read clearly
    const scale = mobile ? MathUtils.clamp((halfW * 0.95) / 2.2, 0.42, 0.56) : MathUtils.clamp((halfW * 0.56) / 2.2, 0.48, 0.82)
    uniforms.uScale.value = scale
    uniforms.uMouseR.value = 0.95 * scale + 0.1

    // living scenes follow how far you've read into each project
    const liveK = reduced ? 1 : 1 - Math.exp(-dt * 3)
    const lp = (i) => { const s = stops.findIndex((q) => q.shape === i); return s < 0 ? 1 : hold(s, y) }
    cur.live3 += ((reduced ? 1 : 0.12 + 0.88 * smooth(0, 0.7, lp(3))) - cur.live3) * liveK
    cur.live4 += ((reduced ? 1 : 0.06 + 0.94 * smooth(0, 0.7, lp(4))) - cur.live4) * liveK
    cur.live5 += ((reduced ? 0 : smooth(0.05, 0.9, lp(5))) - cur.live5) * liveK

    uniforms.uTime.value = time
    uniforms.uSpin.value = spin
    uniforms.uSpinG.value = -HOME.lon * DEG + Math.sin(time * 0.15) * 0.35 + gDrag
    uniforms.uMorph.value = j
    uniforms.uDim.value = cur.dim
    uniforms.uLive3.value = cur.live3
    uniforms.uLive4.value = cur.live4
    uniforms.uLive5.value = cur.live5
    const scatterT = reduced ? 0 : Math.min(Math.abs(vel) * 0.00005, 0.16)
    uniforms.uScatter.value += (scatterT - uniforms.uScatter.value) * (1 - Math.exp(-dt * 4))
    screenToWorld(mouse.x, mouse.y, uniforms.uMouse.value)
    const mf = mouse.active && now - mouse.last < 1800 ? 1 : 0
    uniforms.uMouseF.value += (mf - uniforms.uMouseF.value) * (1 - Math.exp(-dt * 4))
    if (!reduced) uniforms.uPulseT.value += dt

    // intro (big bang)
    if (intro) {
      intro.t += dt
      const x = Math.min(1, intro.t / intro.dur)
      uniforms.uIntro.value = 1 - (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
      if (x >= 1) {
        uniforms.uPulseO.value.copy(st[0]); uniforms.uPulseT.value = 0
        const done = intro.done; intro = null; done()
      }
    }

    // rigs follow their shapes
    const rigAlpha = (i) => Math.max(0, 1 - Math.abs(j - i) * 2)
    for (const rig of [latticeRig, globeRig]) {
      rig.outer.position.copy(st[rig.i])
      rig.outer.scale.setScalar(scale)
      rig.outer.rotation.set(tilt.x, tilt.y, 0)
    }
    latticeRig.inner.rotation.set(0, spin, 0)
    helixRig.outer.position.copy(st[2])
    helixRig.outer.scale.setScalar(scale)
    helixRig.outer.rotation.set(tilt.x, tilt.y, 0)
    globeRig.inner.rotation.set(GLOBE_TILT, uniforms.uSpinG.value, 0)

    uniforms.uFocusAmt.value += (focusTarget - uniforms.uFocusAmt.value) * (1 - Math.exp(-dt * 6))
    cMat.opacity = uniforms.uFocusAmt.value * rigAlpha(6) * 0.8
    const ga = rigAlpha(7)
    const pulse = (time * 0.7) % 1
    pinMat.opacity = ga
    ringMat.opacity = ga * (1 - pulse)
    homeRing.scale.setScalar(1 + pulse * 2.5)
    visitorPin.material.opacity = ga * 0.9
    arcMat.opacity = ga * 0.9
    if (visitor) arcGeo.setDrawRange(0, Math.round(MathUtils.clamp((ga - 0.3) / 0.7, 0, 1) * (ARC + 1)))

    labelAt(labels.home, homeN, globeRig, ga)
    labelAt(labels.visitor, visitorN, globeRig, visitor ? ga : 0)
    labelAt(labels.skill, focusTarget ? focusNode : null, latticeRig, rigAlpha(6) * focusTarget, true)
    const ha = mobile ? 0 : rigAlpha(2)
    labels.beads?.forEach((el, b) => labelAt(el, beadLocal[b], helixRig, b === uniforms.uActiveRole.value ? ha : 0, true))
    beamUni.uTime.value = time
    beamUni.uAlpha.value = uniforms.uFocusAmt.value * rigAlpha(6)

    dUni.uTime.value = time
    for (const m of fogPlanes) m.material.uniforms.uTime.value = time
    const camSpeed = Math.abs(D * (tgt.morph - cur.morph)) * 4.5
    wUni.uWarp.value += ((reduced ? 0 : Math.min(camSpeed * 0.12, 4)) - wUni.uWarp.value) * (1 - Math.exp(-dt * 5))


    const idx = Math.round(j)
    if (idx !== shownShape) {
      shownShape = idx
      const s = stops.find((q) => q.shape === idx)
      onShapeChange?.(idx, stops.length, s ? s.label : '', s ? s.chapter : '')
    }
    onFrame?.({ vel, flight, morph: j })

    if (composer) {
      if (glitch) {
        glitch.uniforms.uAmount.value = reduced ? 0 : Math.min(1, flight * 0.9 + uniforms.uScatter.value * 2)
        glitch.uniforms.uTime.value = time
      }
      if (bloom) bloom.strength = 0.32 + flight * 0.3 + uniforms.uIntro.value * 0.5
      composer.render()
    } else {
      renderer.render(scene, camera)
    }

    // adaptive quality: step down while frames are slow (measured after the intro)
    if (fpsArmed && forced === null && tier > 0 && !document.hidden) {
      fpsFrames++; fpsTime += dt
      if (fpsFrames >= 90) {
        if (fpsTime / fpsFrames > 1 / 40) { tier--; applyTier() }
        fpsFrames = 0; fpsTime = 0
      }
    }
  }
  renderer.setAnimationLoop(frame)

  // project a rig-local point to the screen and position a DOM label there
  const _w = new Vector3(), _n = new Vector3(), _c = new Vector3()
  function labelAt(el, local, rig, alpha, always = false) {
    if (!el) return
    if (!local || alpha < 0.05) { el.style.opacity = 0; return }
    rig.inner.updateWorldMatrix(true, false)
    _w.copy(local).multiplyScalar(always ? 1 : GLOBE_R * 1.02).applyMatrix4(rig.inner.matrixWorld)
    if (!always) {
      _n.copy(local).transformDirection(rig.inner.matrixWorld)
      _c.copy(camera.position).sub(_w).normalize()
      if (_n.dot(_c) < 0.15) { el.style.opacity = 0; return }
    }
    _w.project(camera)
    el.style.opacity = alpha
    const sx = ((_w.x + 1) / 2) * innerWidth, sy = ((1 - _w.y) / 2) * innerHeight
    const flip = sx > innerWidth * 0.62 // keep labels on screen near the right edge
    el.classList.toggle('is-left', flip)
    el.style.transform = `translate(${sx}px, ${sy}px)${flip ? ' translateX(-100%)' : ''}`
  }

  return {
    layout,
    playIntro() {
      if (reducedMQ.matches) { uniforms.uIntro.value = 0; return Promise.resolve() }
      return new Promise((done) => { intro = { t: 0, dur: 2.4, done }; setTimeout(() => { fpsArmed = true }, 3500) })
    },
    setFocus(nodeIndex, related = [], group = -1) {
      if (nodeIndex == null) { focusTarget = 0; uniforms.uFocusGroup.value = -1; return }
      focusTarget = 1
      uniforms.uFocusGroup.value = group
      const rel = related.filter((r) => r !== nodeIndex).slice(0, 8)
      rel.forEach((r, k) => uniforms.uRel.value[k].set(...LATTICE_NODES[r]))
      uniforms.uRelN.value = rel.length
      // dotted beams that flow from the skill to its group-mates
      const bp = beamGeo.getAttribute('position')
      rel.forEach((r, k) => {
        const a = LATTICE_NODES[nodeIndex], b = LATTICE_NODES[r]
        for (let q = 0; q < BEAM; q++) {
          const t = q / (BEAM - 1)
          bp.setXYZ(k * BEAM + q, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)
        }
      })
      bp.needsUpdate = true
      beamGeo.setDrawRange(0, rel.length * BEAM)
      focusNode.set(...LATTICE_NODES[nodeIndex])
      uniforms.uFocus.value.copy(focusNode)
      const pos = cGeo.getAttribute('position')
      let s = 0
      for (const r of related.slice(0, MAXSEG)) {
        if (r === nodeIndex) continue
        pos.setXYZ(s * 2, ...LATTICE_NODES[nodeIndex])
        pos.setXYZ(s * 2 + 1, ...LATTICE_NODES[r])
        s++
      }
      pos.needsUpdate = true
      cGeo.setDrawRange(0, s * 2)
    },
    dragStart() { dragging = true; lastDrag = performance.now(); spinVel = 0 },
    drag,
    dragEnd() { dragging = false },
    setActiveRole(i) { uniforms.uActiveRole.value = i },
    setGyro(x, y) { gyro.on = true; gyro.x = MathUtils.clamp(x, -1, 1); gyro.y = MathUtils.clamp(y, -1, 1) },
    setVisitor,
    get tier() { return tier },
    get settled() { return Math.abs(sample(scrollY).morph - cur.morph) < 0.02 },
    get debug() { return { focus: uniforms.uFocusAmt.value, focusTarget, morph: uniforms.uMorph.value, y: scrollY, target: sample(scrollY).morph, cur: cur.morph, stops: stops.map((q) => [q.shape, Math.round(q.top), Math.round(q.b), Math.round(q.T)]) } },
  }
}
