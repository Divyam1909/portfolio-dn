// Point-cloud generators. Each returns { pos, order } where `pos` holds exactly `n`
// xyz points (roughly within a radius of ~2.2 units) and `order` holds 4 floats per
// point used by the "living" scenes (candle time, leaf growth, page flip u/v).
// Points are shuffled so any prefix of the buffer is an even sample of the whole
// shape — that lets the renderer draw fewer particles on slower devices.

import { LAND_W, LAND_H, LAND_B64 } from './landmask.js'

export function rng(seed = 1) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TAU = Math.PI * 2
const DEG = Math.PI / 180

function gauss(r) {
  return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(TAU * r())
}

function randomOnSphere(r) {
  const u = r() * 2 - 1
  const t = r() * TAU
  const s = Math.sqrt(1 - u * u)
  return [s * Math.cos(t), u, s * Math.sin(t)]
}

// parts: [[weight, fn(i, count, r) => [x, y, z, o0?, o1?, o2?, o3?]], ...]
function compose(n, seed, parts) {
  const r = rng(seed)
  const pos = new Float32Array(n * 3)
  const order = new Float32Array(n * 4).fill(-1)
  const total = parts.reduce((a, p) => a + p[0], 0)
  let i = 0
  parts.forEach(([w, fn], k) => {
    const count = k === parts.length - 1 ? n - i : Math.round((w / total) * n)
    for (let c = 0; c < count && i < n; c++, i++) {
      const p = fn(c, count, r)
      pos.set(p.slice(0, 3), i * 3)
      if (p.length > 3) order.set(p.slice(3), i * 4)
    }
  })
  // Fisher–Yates shuffle, keeping pos/order pairs together
  for (let a = n - 1; a > 0; a--) {
    const b = Math.floor(r() * (a + 1))
    for (let k = 0; k < 3; k++) { const t = pos[a * 3 + k]; pos[a * 3 + k] = pos[b * 3 + k]; pos[b * 3 + k] = t }
    for (let k = 0; k < 4; k++) { const t = order[a * 4 + k]; order[a * 4 + k] = order[b * 4 + k]; order[b * 4 + k] = t }
  }
  return { pos, order }
}

export function rotate(p, ax, ay, az = 0) {
  let [x, y, z] = p
  let c = Math.cos(ax), s = Math.sin(ax)
  ;[y, z] = [y * c - z * s, y * s + z * c]
  c = Math.cos(ay); s = Math.sin(ay)
  ;[x, z] = [x * c + z * s, -x * s + z * c]
  c = Math.cos(az); s = Math.sin(az)
  ;[x, y] = [x * c - y * s, x * s + y * c]
  return [x, y, z]
}

/* 0 — Neural sphere with orbit rings */
export function neuralSphere(n) {
  const nodes = []
  const r0 = rng(7)
  for (let i = 0; i < 14; i++) nodes.push(randomOnSphere(r0))
  const R = 1.35
  return compose(n, 11, [
    [55, (i, count, r) => {
      const y = 1 - (i / (count - 1)) * 2
      const rad = Math.sqrt(1 - y * y)
      const th = i * 2.399963
      const k = R * (1 + gauss(r) * 0.015)
      return [Math.cos(th) * rad * k, y * k, Math.sin(th) * rad * k]
    }],
    [15, (i, c, r) => {
      const nd = nodes[i % nodes.length]
      const s = 0.09
      return [(nd[0] + gauss(r) * s) * R, (nd[1] + gauss(r) * s) * R, (nd[2] + gauss(r) * s) * R]
    }],
    [30, (i, c, r) => {
      const ring = i % 3
      const a = r() * TAU
      const rr = 1.85 + ring * 0.22 + gauss(r) * 0.012
      const p = [Math.cos(a) * rr, gauss(r) * 0.01, Math.sin(a) * rr]
      const tilts = [[1.15, 0.2, 0.3], [1.35, -0.4, -0.5], [1.05, 0.9, 0.1]]
      return rotate(p, ...tilts[ring])
    }],
  ])
}

/* Text sampled from a canvas */
function textShape(n, seed, text, font, width) {
  const W = 900, H = 300
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = font
  ctx.fillText(text, W / 2, H / 2 + 10)
  const data = ctx.getImageData(0, 0, W, H).data
  const pts = []
  let minX = W, maxX = 0
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      if (data[(y * W + x) * 4 + 3] > 128) { pts.push(x, y); minX = Math.min(minX, x); maxX = Math.max(maxX, x) }
    }
  }
  const scale = width / Math.max(1, maxX - minX)
  const cx = (minX + maxX) / 2
  return compose(n, seed, [
    [100, (i, c, r) => {
      if (!pts.length) return randomOnSphere(r)
      const k = Math.floor(r() * (pts.length / 2)) * 2
      return [(pts[k] + r() * 2 - cx) * scale, -(pts[k + 1] + r() * 2 - H / 2) * scale, gauss(r) * 0.08]
    }],
  ])
}

/* 1 — "DN" monogram */
export const monogram = (n) => textShape(n, 21, 'DN', "italic 400 270px 'Instrument Serif', 'Times New Roman', serif", 3.6)

/* 2 — Double helix (data pipelines) */
export function helix(n) {
  const L = 1.6, R = 0.52, turns = 2.2
  const at = (t, phase) => {
    const a = t * turns * TAU + phase
    return [t * 2 * L - L, Math.cos(a) * R, Math.sin(a) * R]
  }
  const tilt = (p) => rotate(p, 0.35, 0.25, -0.18)
  return compose(n, 31, [
    [38, (i, c, r) => { const p = at(r(), 0); return tilt([p[0], p[1] + gauss(r) * 0.035, p[2] + gauss(r) * 0.035]) }],
    [38, (i, c, r) => { const p = at(r(), Math.PI); return tilt([p[0], p[1] + gauss(r) * 0.035, p[2] + gauss(r) * 0.035]) }],
    [18, (i, c, r) => {
      const rung = Math.floor(r() * 34)
      const t = (rung + 0.5) / 34
      const a = at(t, 0), b = at(t, Math.PI), s = r()
      return tilt([a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s])
    }],
    [6, (i, c, r) => tilt([(r() * 2 - 1) * L * 1.1, gauss(r) * 0.9, gauss(r) * 0.9])],
  ])
}

/* 3 — Candlestick chart (stock prediction). order.x = time (0 → 1, left → right) */
export function candles(n) {
  const r0 = rng(99)
  const count = 14
  const series = []
  let price = 0
  for (let i = 0; i < count; i++) {
    const open = price
    price += (r0() - 0.42) * 0.55
    const close = price
    series.push({ open, close, hi: Math.max(open, close) + r0() * 0.25, lo: Math.min(open, close) - r0() * 0.25 })
  }
  const min = Math.min(...series.map((s) => s.lo))
  const max = Math.max(...series.map((s) => s.hi))
  const ny = (v) => ((v - min) / (max - min)) * 2.6 - 1.3
  const W = 3.3, bw = 0.07
  const tilt = (p) => rotate(p, 0.1, -0.28)
  const X = (k) => (k / (count - 1)) * W - W / 2
  return compose(n, 41, [
    [76, (i, c, r) => {
      const k = Math.floor(r() * count)
      const s = series[k]
      let a = ny(Math.min(s.open, s.close)), b = ny(Math.max(s.open, s.close))
      if (b - a < 0.05) b = a + 0.05
      let px = (r() * 2 - 1) * bw, pz = (r() * 2 - 1) * bw
      if (r() < 0.5) px = Math.sign(px) * bw
      else pz = Math.sign(pz) * bw
      return [...tilt([X(k) + px, a + r() * (b - a), pz]), k / (count - 1), -1, -1, -1]
    }],
    [16, (i, c, r) => {
      const k = Math.floor(r() * count)
      const s = series[k]
      return [...tilt([X(k) + gauss(r) * 0.008, ny(s.lo) + r() * (ny(s.hi) - ny(s.lo)), gauss(r) * 0.008]), k / (count - 1), -1, -1, -1]
    }],
    [8, (i, c, r) => {
      // moving-average trend line floating in front
      const t = r() * (count - 1)
      const k = Math.floor(t), f = t - k
      const v = (j) => { const s = series[Math.min(count - 1, j)]; return (s.open + s.close) / 2 }
      const y = ny(v(k) * (1 - f) + v(k + 1) * f)
      return [...tilt([(t / (count - 1)) * W - W / 2, y + gauss(r) * 0.012, 0.35 + gauss(r) * 0.012]), t / (count - 1), -1, -1, -1]
    }],
  ])
}

/* 4 — Leaf (biomass estimation). order.y = growth (0 base → 1 tip) */
const LEAF_LEN = 3.6
const LEAF_ROT = [-0.45, 0.35, -0.55]
export const LEAF_BASE = rotate([0, -LEAF_LEN / 2, 0], ...LEAF_ROT)
export function leaf(n) {
  const len = LEAF_LEN
  const halfW = (t) => Math.pow(Math.sin(Math.PI * Math.pow(t, 0.85)), 1.1) * (1 - 0.25 * t)
  const place = (t, s) => {
    const w = halfW(t)
    const z = 0.28 * s * s - 0.21 * Math.sin(Math.PI * t) + 0.2 * t * t
    return [...rotate([s * w, t * len - len / 2, z], ...LEAF_ROT), -1, t * 0.85 + Math.abs(s) * 0.15, -1, -1]
  }
  return compose(n, 51, [
    [52, (i, c, r) => place(r(), (r() * 2 - 1) * 0.98)],
    [14, (i, c, r) => place(r(), r() < 0.5 ? -1 : 1)],
    [10, (i, c, r) => { const p = place(r(), 0); p[0] += gauss(r) * 0.012; p[2] += gauss(r) * 0.012; return p }],
    [20, (i, c, r) => {
      const v = Math.floor(r() * 16)
      const side = v % 2 ? 1 : -1
      const t0 = 0.08 + (Math.floor(v / 2) / 8) * 0.8
      const s = r()
      return place(Math.min(1, t0 + s * 0.16), side * s * 0.95)
    }],
    [4, (i, c, r) => { const t = -r() * 0.12; return [...rotate([gauss(r) * 0.01, t * len - len / 2, 0], ...LEAF_ROT), -1, 0, -1, -1] }],
  ])
}

/* 5 — Open book (education platform). Flipping-page particles carry order.z = page*2 + u, order.w = v.
   The same page() math is mirrored in the vertex shader (see scene.js) to animate the flip. */
export const BOOK = { H: 1.1, W: 1.35, LIFT: 0.62, ROT: [-0.95, 0.28, 0.08] }
function bookPage(u, v, side, layer) {
  const lift = BOOK.LIFT * Math.sin(Math.min(1, u) * Math.PI * 0.62)
  const x = side * (0.03 + u * BOOK.W * (1 - layer * 0.012))
  const z = lift - layer * 0.045 * Math.pow(u, 0.6)
  return rotate([x, v * BOOK.H, z], ...BOOK.ROT)
}
export function book(n) {
  return compose(n, 61, [
    [36, (i, c, r) => bookPage(r(), r() * 2 - 1, r() < 0.5 ? -1 : 1, 0)],
    [18, (i, c, r) => bookPage(r(), r() < 0.5 ? -1 : 1, r() < 0.5 ? -1 : 1, Math.floor(r() * 7))],
    [12, (i, c, r) => bookPage(1, r() * 2 - 1, r() < 0.5 ? -1 : 1, Math.floor(r() * 7))],
    [18, (i, c, r) => {
      const side = r() < 0.5 ? -1 : 1
      const row = Math.floor(r() * 12)
      const v = 0.78 - (row / 11) * 1.56
      const u = 0.12 + r() * (row % 4 === 3 ? 0.4 : 0.74)
      const p = bookPage(u, v, side, 0)
      return [p[0], p[1], p[2] + 0.012]
    }],
    [16, (i, c, r) => {
      // three loose pages that turn as you scroll
      const page = Math.floor(r() * 3)
      const u = r(), v = r() * 2 - 1
      return [...bookPage(u, v, 1, 0), -1, -1, page * 2 + u, v]
    }],
  ])
}

/* 6 — Skill lattice */
const G = 4, GS = 2.0
export const LATTICE_NODES = []
for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) for (let k = 0; k < G; k++) {
  LATTICE_NODES.push([(i / (G - 1) - 0.5) * GS, (j / (G - 1) - 0.5) * GS, (k / (G - 1) - 0.5) * GS])
}
export function lattice(n) {
  const node = (i, j, k) => LATTICE_NODES[i * G * G + j * G + k]
  return compose(n, 71, [
    [80, (c, count, r) => {
      const axis = Math.floor(r() * 3)
      const a = Math.floor(r() * G), b = Math.floor(r() * G), s = Math.floor(r() * (G - 1))
      const f = r()
      const ids = axis === 0 ? [[s, a, b], [s + 1, a, b]] : axis === 1 ? [[a, s, b], [a, s + 1, b]] : [[a, b, s], [a, b, s + 1]]
      const p0 = node(...ids[0]), p1 = node(...ids[1])
      return [0, 1, 2].map((q) => p0[q] + (p1[q] - p0[q]) * f + gauss(r) * 0.006)
    }],
    [20, (c, count, r) => {
      const p = node(Math.floor(r() * G), Math.floor(r() * G), Math.floor(r() * G))
      return [p[0] + gauss(r) * 0.045, p[1] + gauss(r) * 0.045, p[2] + gauss(r) * 0.045]
    }],
  ])
}

/* 7 — Globe with real continents and arcs from home to the world */
export const GLOBE_R = 1.55
export const HOME = { lat: 19.2, lon: 72.97, name: 'Thane' }
export function latLon(lat, lon, R = GLOBE_R) {
  const a = lat * DEG, b = lon * DEG
  return [Math.cos(a) * Math.sin(b) * R, Math.sin(a) * R, Math.cos(a) * Math.cos(b) * R]
}
let landBits = null
function isLand(lat, lon) {
  if (!landBits) landBits = Uint8Array.from(atob(LAND_B64), (c) => c.charCodeAt(0))
  const x = Math.min(LAND_W - 1, Math.floor(((lon + 180) / 360) * LAND_W))
  const y = Math.min(LAND_H - 1, Math.floor(((90 - lat) / 180) * LAND_H))
  const i = y * LAND_W + x
  return (landBits[i >> 3] >> (i & 7)) & 1
}
const HUBS = [[37.77, -122.42], [40.71, -74.0], [51.5, -0.12], [52.52, 13.4], [1.35, 103.82], [35.68, 139.69], [-33.87, 151.21], [25.2, 55.27], [12.97, 77.59]]
export function arcPoint(a, b, t, lift = 0.32) {
  const x = a[0] * (1 - t) + b[0] * t, y = a[1] * (1 - t) + b[1] * t, z = a[2] * (1 - t) + b[2] * t
  const l = Math.hypot(x, y, z) || 1
  const h = GLOBE_R * (1 + Math.sin(Math.PI * t) * lift)
  return [(x / l) * h, (y / l) * h, (z / l) * h]
}
export function globe(n) {
  const R = GLOBE_R
  const home = latLon(HOME.lat, HOME.lon, 1)
  const hubs = HUBS.map(([la, lo]) => latLon(la, lo, 1))
  return compose(n, 81, [
    [64, (i, c, r) => {
      let lat = 0, lon = 0
      for (let tries = 0; tries < 40; tries++) {
        const p = randomOnSphere(r)
        lat = Math.asin(p[1]) / DEG
        lon = Math.atan2(p[0], p[2]) / DEG
        if (isLand(lat, lon)) break
      }
      return latLon(lat, lon, R * (1 + gauss(r) * 0.004))
    }],
    [20, (i, c, r) => {
      if (r() < 0.5) {
        const lat = (Math.floor(r() * 7) - 3) * 22.5
        return latLon(lat, r() * 360 - 180, R * 0.995)
      }
      return latLon(r() * 180 - 90, Math.floor(r() * 12) * 30 - 180, R * 0.995)
    }],
    [16, (i, c, r) => arcPoint(home, hubs[i % hubs.length], r())],
  ])
}

export const SHAPES = [neuralSphere, monogram, helix, candles, leaf, book, lattice, globe]
