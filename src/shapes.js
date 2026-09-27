// Point-cloud generators. Each returns { pos, order } where `pos` holds exactly `n`
// xyz points (roughly within a radius of ~2.2 units) and `order` holds 4 floats per
// point that the shader uses to animate that shape (packets, waves, orbits, page flips…).
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

export function gauss(r) {
  return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(TAU * r())
}

export function randomOnSphere(r) {
  const u = r() * 2 - 1
  const t = r() * TAU
  const s = Math.sqrt(1 - u * u)
  return [s * Math.cos(t), u, s * Math.sin(t)]
}

// parts: [[weight, fn(i, count, r) => [x, y, z, o0?, o1?, o2?, o3?]], ...]
export function compose(n, seed, parts) {
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
      if (p.length > 3) order.set(p.slice(3, 7), i * 4)
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

/* Double helix (Internships intro) with data packets streaming along the strands.
   order.x = strand * 2 + packet t */
export const HELIX = { L: 1.6, R: 0.52, TURNS: 2.2, ROT: [0.35, 0.25, -0.18] }
export function helix(n) {
  const { L, R, TURNS } = HELIX
  const at = (t, phase, rad = R) => {
    const a = t * TURNS * TAU + phase
    return [t * 2 * L - L, Math.cos(a) * rad, Math.sin(a) * rad]
  }
  const tilt = (p) => rotate(p, ...HELIX.ROT)
  return compose(n, 31, [
    [36, (i, c, r) => { const p = at(r(), 0); return tilt([p[0], p[1] + gauss(r) * 0.035, p[2] + gauss(r) * 0.035]) }],
    [36, (i, c, r) => { const p = at(r(), Math.PI); return tilt([p[0], p[1] + gauss(r) * 0.035, p[2] + gauss(r) * 0.035]) }],
    [16, (i, c, r) => {
      const rung = Math.floor(r() * 34)
      const t = (rung + 0.5) / 34
      const a = at(t, 0), b = at(t, Math.PI), s = r()
      return tilt([a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s])
    }],
    [8, (i, c, r) => {
      const strand = r() < 0.5 ? 0 : 1
      const t = (Math.floor(r() * 9) / 9 + r() * 0.035) % 1
      return [...tilt(at(t, strand * Math.PI, R * 1.22)), t + strand * 2]
    }],
    [4, (i, c, r) => tilt([(r() * 2 - 1) * L * 1.1, gauss(r) * 0.9, gauss(r) * 0.9])],
  ])
}

/* ---------- Internship models ---------- */
// helpers: points on a line segment / rectangle outline / filled rectangle (in a plane)
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const jitter = (p, r, s) => [p[0] + gauss(r) * s, p[1] + gauss(r) * s, p[2] + gauss(r) * s]
function rectEdge(r, w, h) {
  // random point on the outline of a w×h rectangle centred at 0 (x, y)
  const per = 2 * (w + h), d = r() * per
  if (d < w) return [d - w / 2, h / 2]
  if (d < w + h) return [w / 2, h / 2 - (d - w)]
  if (d < 2 * w + h) return [w / 2 - (d - w - h), -h / 2]
  return [-w / 2, -h / 2 + (d - 2 * w - h)]
}

/* ZetaQ — PDFs flow through an LLM core and come out as tidy study cards.
   Flow particles: order = (phase, laneY, laneZ, 1). Tilt is applied in the shader too. */
export const PIPE_ROT = [0.12, -0.42, 0]
export function pipeline(n) {
  const T = (p) => rotate(p, ...PIPE_ROT)
  const sheet = (k, r) => {
    // three stacked, slightly fanned PDF pages on the left
    const ox = -1.62 + k * 0.1, oy = 0.12 - k * 0.12, oz = -k * 0.16
    const w = 0.95, h = 1.25
    const q = r()
    let x, y
    if (q < 0.45) { [x, y] = rectEdge(r, w, h) }
    else if (q < 0.8) { const row = Math.floor(r() * 9); y = h / 2 - 0.2 - row * 0.11; x = -w / 2 + 0.12 + r() * (row % 3 === 2 ? 0.45 : 0.7) }
    else { x = (r() - 0.5) * w; y = (r() - 0.5) * h }
    return T(jitter([ox + x, oy + y, oz], r, 0.006))
  }
  return compose(n, 131, [
    [30, (i, c, r) => sheet(i % 3, r)],
    [20, (i, c, r) => {
      // LLM core: a ring the data passes through, around a bright nucleus
      if (r() < 0.55) { const a = r() * TAU; return T(jitter([0, Math.sin(a) * 0.62, Math.cos(a) * 0.62], r, 0.02)) }
      const d = randomOnSphere(r).map((v) => v * 0.26 * Math.cbrt(r()))
      return T(d)
    }],
    [24, (i, c, r) => {
      // output: a clean 2×3 grid of study cards
      const k = i % 6, col = k % 2, row = Math.floor(k / 2)
      const cx = 1.25 + col * 0.62, cy = 0.62 - row * 0.62
      const w = 0.5, h = 0.46
      let x, y
      if (r() < 0.55) [x, y] = rectEdge(r, w, h)
      else { const line = Math.floor(r() * 3); y = h / 2 - 0.12 - line * 0.11; x = -w / 2 + 0.08 + r() * (line === 0 ? 0.34 : 0.22) }
      return T(jitter([cx + x, cy + y, 0], r, 0.005))
    }],
    [26, (i, c, r) => {
      // the flow: lanes that converge into the core and fan out again
      const laneY = (r() - 0.5) * 1.1, laneZ = (r() - 0.5) * 0.5
      return [...T([0, 0, 0]), r(), laneY, laneZ, 1]
    }],
  ])
}

/* Thinking Engines — full stack as three floating layers: UI, API, database.
   Packets rising between layers: order = (phase, laneX, laneZ, 1). */
export const STACK_ROT = [0.78, 0.55, 0]
// Thinking Engines builds football player-performance analytics: the UI layer is a live pitch.
export function stack(n) {
  const T = (p) => rotate(p, ...STACK_ROT)
  const W = 2.3, Dp = 1.5
  return compose(n, 141, [
    [30, (i, c, r) => {
      // top: the product itself — a football pitch the players are tracked on
      const y = 1.1, q = r(), PW = 2.6, PD = 1.6
      let x, z, yy = y
      if (q < 0.26) { const e = rectEdge(r, PW, PD); x = e[0]; z = e[1] }
      else if (q < 0.33) { x = 0; z = (r() - 0.5) * PD }
      else if (q < 0.43) { const a = r() * TAU; x = Math.cos(a) * 0.28; z = Math.sin(a) * 0.28 }
      else if (q < 0.63) { const side = r() < 0.5 ? -1 : 1; const e = rectEdge(r, 0.5, 1.0); x = side * (PW / 2 - 0.25) + e[0]; z = e[1]; if (side * x > PW / 2) x = side * PW / 2 }
      else if (q < 0.73) { const side = r() < 0.5 ? -1 : 1, t = r(); x = side * PW / 2; z = (t - 0.5) * 0.4; yy = y + (r() < 0.5 ? 0.14 : r() * 0.14) } // goal frames
      else { const band = Math.floor(r() * 10); if (band % 2) { x = -PW / 2 + (band + r()) * (PW / 10); z = (r() - 0.5) * PD } else { x = 0; z = 0 } } // mowing stripes
      return T(jitter([x, yy, z], r, 0.005))
    }],
    [12, (i, c, r) => {
      // players: two teams of five, each a small upright figure; they move in the shader (order = k, baseX, baseZ, 2)
      const k = i % 10, team = k < 5 ? -1 : 1, slot = k % 5
      const bx = team * [0.28, 0.62, 0.62, 0.95, 0.32][slot] * (slot === 4 ? -0.3 : 1), bz = [0, -0.5, 0.5, 0, 0.42][slot] * (team < 0 ? 1 : -1)
      return [gauss(r) * 0.03, r() * 0.18, gauss(r) * 0.03, k, bx, bz, 2]
    }],
    [4, (i, c, r) => { const a = r() * TAU; return [Math.cos(a) * 0.14, 0.005, Math.sin(a) * 0.14, 0, -0.3, 0, 3] }],
    [5, (i, c, r) => [r(), 0, 0, 0, -0.3, 0, 4]],
    [9, (i, c, r) => {
      // middle: API layer — a plate with a grid of connected endpoints
      const y = 0, q = r()
      if (q < 0.3) { const e = rectEdge(r, W * 0.86, Dp * 0.86); return T(jitter([e[0], y, e[1]], r, 0.006)) }
      const gx = Math.floor(r() * 4), gz = Math.floor(r() * 3)
      const nx = -0.75 + gx * 0.5, nz = -0.4 + gz * 0.4
      if (q < 0.65) return T(jitter([nx, y, nz], r, 0.03))
      const horiz = r() < 0.5, t = r()
      return T(jitter(horiz && gx < 3 ? [nx + t * 0.5, y, nz] : gz < 2 ? [nx, y, nz + t * 0.4] : [nx, y, nz], r, 0.006))
    }],
    [12, (i, c, r) => {
      // bottom: database cylinder built from stacked disks
      const R = 0.6, q = r(), a = r() * TAU
      if (q < 0.6) { const k = Math.floor(r() * 3); return T(jitter([Math.cos(a) * R, -1.15 + k * 0.2, Math.sin(a) * R], r, 0.008)) }
      if (q < 0.85) return T(jitter([Math.cos(a) * R, -1.15 + r() * 0.4, Math.sin(a) * R], r, 0.01))
      return T(jitter([Math.cos(a) * R * Math.sqrt(r()), -0.75, Math.sin(a) * R * Math.sqrt(r())], r, 0.005))
    }],
    [9, (i, c, r) => {
      const laneX = [-0.5, 0, 0.5][i % 3] + gauss(r) * 0.02, laneZ = [0.1, -0.2, 0.25][i % 3] + gauss(r) * 0.02
      return [...T([laneX, 0, laneZ]), r(), laneX, laneZ, 1]
    }],
  ])
}

/* Arms Robotics — a microchip streaming real-time data over traces to a live dashboard.
   Waveform particles: order.x = u along the wave. Trace particles: order.y = t along the trace. */
export const CHIP_ROT = [0.3, -0.34, 0]
export function chip(n) {
  const T = (p) => rotate(p, ...CHIP_ROT)
  const cx = -1.15
  const traces = [0.28, 0.1, -0.1, -0.28].map((y, k) => [[cx + 0.62, y, 0], [cx + 0.95 + k * 0.08, y, 0], [cx + 0.95 + k * 0.08, y * 0.5 - 0.1, 0], [0.45, y * 0.5 - 0.1, 0]])
  const tracePoint = (tr, t) => {
    const lens = [0, 1, 2].map((s) => Math.hypot(...tr[s + 1].map((v, k) => v - tr[s][k])))
    let d = t * lens.reduce((a, b) => a + b)
    for (let s = 0; s < 3; s++) { if (d <= lens[s] || s === 2) return lerp3(tr[s], tr[s + 1], Math.min(1, d / lens[s])); d -= lens[s] }
  }
  return compose(n, 151, [
    [30, (i, c, r) => {
      // chip: package outline, fill, inner die and pins on all four sides
      const q = r()
      if (q < 0.3) { const e = rectEdge(r, 1.1, 1.1); return T(jitter([cx + e[0], e[1], 0], r, 0.006)) }
      if (q < 0.5) { const e = rectEdge(r, 0.5, 0.5); return T(jitter([cx + e[0], e[1], 0.02], r, 0.005)) }
      if (q < 0.62) return T([cx + (r() - 0.5) * 1.05, (r() - 0.5) * 1.05, -0.01])
      const side = Math.floor(r() * 4), k = Math.floor(r() * 7), t = r()
      const off = -0.42 + k * 0.14, len = 0.16
      const pts = [[cx + off, 0.55 + t * len], [cx + off, -0.55 - t * len], [cx - 0.55 - t * len, off], [cx + 0.55 + t * len, off]]
      return T(jitter([...pts[side], 0], r, 0.006))
    }],
    [16, (i, c, r) => { const t = r(); return [...T(jitter(tracePoint(traces[i % 4], t), r, 0.006)), -1, t] }],
    [24, (i, c, r) => {
      // dashboard panel with header, axis and a small bar chart
      const px = 1.25, q = r()
      if (q < 0.45) { const e = rectEdge(r, 1.55, 1.15); return T(jitter([px + e[0], e[1], 0], r, 0.006)) }
      if (q < 0.55) return T(jitter([px - 0.7 + r() * 1.4, 0.4, 0], r, 0.005))
      if (q < 0.65) return T(jitter([px - 0.65 + r() * 1.3, -0.12, 0], r, 0.004))
      const b = Math.floor(r() * 6), h = [0.18, 0.3, 0.22, 0.36, 0.26, 0.4][b]
      return T(jitter([px - 0.6 + b * 0.16 + (r() - 0.5) * 0.08, -0.5 + r() * h, 0], r, 0.004))
    }],
    [30, (i, c, r) => [...T([0, 0, 0]), r()]],
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
// the whole scene (photo → CNN → leaf) is tilted by BIO_ROT; the leaf is shrunk and moved to the right
export const BIO_ROT = [0.08, -0.32, 0]
const LEAF_S = 0.55, LEAF_OFF = [1.12, -0.05, 0]
const leafT = (p) => rotate([p[0] * LEAF_S + LEAF_OFF[0], p[1] * LEAF_S + LEAF_OFF[1], p[2] * LEAF_S + LEAF_OFF[2]], ...BIO_ROT)
export const LEAF_BASE = leafT(rotate([0, -LEAF_LEN / 2, 0], ...LEAF_ROT))
export function leaf(n) {
  const len = LEAF_LEN
  const halfW = (t) => Math.pow(Math.sin(Math.PI * Math.pow(t, 0.85)), 1.1) * (1 - 0.25 * t)
  const place = (t, s) => {
    const w = halfW(t)
    const z = 0.28 * s * s - 0.21 * Math.sin(Math.PI * t) + 0.2 * t * t
    return [...leafT(rotate([s * w, t * len - len / 2, z], ...LEAF_ROT)), -1, t * 0.85 + Math.abs(s) * 0.15, -1, -1]
  }
  const B = (p) => rotate(p, ...BIO_ROT)
  return compose(n, 51, [
    [16, (i, c, r) => {
      // the input: an aerial photo of a field — frame plus rows of crops as a pixel grid
      const cx = -1.45, S = 0.95
      if (r() < 0.3) { const e = rectEdge(r, S, S); return B(jitter([cx + e[0], e[1], 0], r, 0.005)) }
      for (let t = 0; t < 12; t++) {
        const gx = Math.floor(r() * 22), gy = Math.floor(r() * 22)
        const dens = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(gy * 0.9 + Math.sin(gx * 0.4) * 1.5))
        if (r() < dens) return B([cx - S / 2 + (gx + 0.5) * (S / 22), -S / 2 + (gy + 0.5) * (S / 22), 0])
      }
      return B([cx, 0, 0])
    }],
    [12, (i, c, r) => {
      // CNN feature maps, shrinking layer by layer
      const k = i % 3, cx = [-0.55, -0.12, 0.25][k], S = [0.8, 0.58, 0.38][k], g = [8, 6, 4][k]
      const q = r()
      let a, b
      if (q < 0.45) [a, b] = rectEdge(r, S, S)
      else { a = -S / 2 + (Math.floor(r() * g) + 0.5) * (S / g); b = -S / 2 + (Math.floor(r() * g) + 0.5) * (S / g) }
      return B(jitter([cx + a * 0.45, b, a * 0.9], r, 0.006))
    }],
    [10, (i, c, r) => [0, 0, 0, r(), (r() - 0.5) * 0.8, (r() - 0.5) * 0.5, 1]], // flow: photo → layers → leaf
    [34, (i, c, r) => place(r(), (r() * 2 - 1) * 0.98)],
    [10, (i, c, r) => place(r(), r() < 0.5 ? -1 : 1)],
    [6, (i, c, r) => { const p = place(r(), 0); p[0] += gauss(r) * 0.008; p[2] += gauss(r) * 0.008; return p }],
    [10, (i, c, r) => {
      const v = Math.floor(r() * 16)
      const side = v % 2 ? 1 : -1
      const t0 = 0.08 + (Math.floor(v / 2) / 8) * 0.8
      const s = r()
      return place(Math.min(1, t0 + s * 0.16), side * s * 0.95)
    }],
    [2, (i, c, r) => { const t = -r() * 0.12; return [...leafT(rotate([gauss(r) * 0.01, t * len - len / 2, 0], ...LEAF_ROT)), -1, 0, -1, -1] }],
  ])
}

/* 5 — Open book (education platform). Flipping-page particles carry order.z = page*2 + u, order.w = v.
   The same page() math is mirrored in the vertex shader (see scene.js) to animate the flip. */
export const BOOK = { H: 1.1, W: 1.35, LIFT: 0.62, ROT: [-0.95, 0.28, 0.08], S: 0.72, OFF: [0, -0.62, 0.15] }
function bookPage(u, v, side, layer) {
  const lift = BOOK.LIFT * Math.sin(Math.min(1, u) * Math.PI * 0.62)
  const x = side * (0.03 + u * BOOK.W * (1 - layer * 0.012))
  const z = lift - layer * 0.045 * Math.pow(u, 0.6)
  const q = rotate([x, v * BOOK.H, z], ...BOOK.ROT)
  return [q[0] * BOOK.S + BOOK.OFF[0], q[1] * BOOK.S + BOOK.OFF[1], q[2] * BOOK.S + BOOK.OFF[2]]
}
// the AI reader: a robot head above the book, eyes scanning the right-hand page
export const ROBOT = { C: [0, 0.72, -0.3], EYES: [[-0.19, 0.76, -0.04], [0.19, 0.76, -0.04]] }
function robot(i, r) {
  const [cx, cy, cz] = ROBOT.C, q = r(), W = 0.95, H = 0.66, D = 0.5
  const NO = [-1, -1, -1, -1]
  if (q < 0.34) { // head: rounded front/back outline + depth edges
    const e = rectEdge(r, W, H), front = r() < 0.65
    return [...jitter([cx + e[0], cy + e[1], cz + (front ? D / 2 : -D / 2)], r, 0.007), ...NO]
  }
  if (q < 0.42) { const sx = r() < 0.5 ? -1 : 1, sy = r() < 0.5 ? -1 : 1; return [...jitter([cx + sx * W / 2, cy + sy * H / 2, cz + (r() - 0.5) * D], r, 0.007), ...NO] }
  if (q < 0.52) { const e = rectEdge(r, W * 0.78, H * 0.62); return [...jitter([cx + e[0], cy + 0.02 + e[1], cz + D / 2 + 0.01], r, 0.005), ...NO] } // face screen
  if (q < 0.66) { // eyes (order.x = 1, order.w = eye) — blink in the shader
    const k = r() < 0.5 ? 0 : 1, a = r() * TAU, rr = 0.075 * Math.sqrt(r())
    const e = ROBOT.EYES[k]
    return [e[0] + Math.cos(a) * rr, e[1] + Math.sin(a) * rr, e[2], 1, -1, -1, k]
  }
  if (q < 0.7) { const t = r(); return [...jitter([cx - 0.12 + 0.24 * t, cy - 0.16, cz + D / 2 + 0.01], r, 0.005), ...NO] } // mouth
  if (q < 0.76) { const t = r(); return t < 0.8 ? [...jitter([cx, cy + H / 2 + t * 0.26, cz], r, 0.006), ...NO] : [...jitter([cx, cy + H / 2 + 0.3, cz], r, 0.035), 3, -1, -1, -1] } // antenna
  if (q < 0.82) { const sx = r() < 0.5 ? -1 : 1, a = r() * TAU; return [...jitter([cx + sx * (W / 2 + 0.05), cy + Math.cos(a) * 0.1, cz + Math.sin(a) * 0.1], r, 0.006), ...NO] } // ears
  if (q < 0.9) { // arms reaching down to hold the book
    const sx = r() < 0.5 ? -1 : 1, t = r()
    return [...jitter(lerp3([cx + sx * 0.4, cy - H / 2, cz], bookPage(0.92, 0.78, sx, 0), t), r, 0.01), ...NO]
  }
  return [0, 0, 0, 2, r(), -1, i % 2] // scan beams from each eye to the line being read
}
export function book(n) {
  return compose(n, 61, [
    [24, (i, c, r) => robot(i, r)],
    [28, (i, c, r) => bookPage(r(), r() * 2 - 1, r() < 0.5 ? -1 : 1, 0)],
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
// order2: z = skill-group ring (0 Languages, 1 Web, 2 AI/ML, 3 Data & tools), w = angle 0..1
// Project "stars" orbit the lattice; skills link to them. order.x = project index.
export const PROJECT_NODES = Array.from({ length: 10 }, (_, k) => {
  const a = (k / 10) * TAU + 0.2
  return [Math.cos(a) * 1.72, (k % 2 ? 0.5 : -0.4) + Math.sin(k * 1.7) * 0.2, Math.sin(a) * 1.72]
})
export function lattice(n) {
  const node = (i, j, k) => LATTICE_NODES[i * G * G + j * G + k]
  return compose(n, 71, [
    [66, (c, count, r) => {
      const axis = Math.floor(r() * 3)
      const a = Math.floor(r() * G), b = Math.floor(r() * G), s = Math.floor(r() * (G - 1))
      const f = r()
      const ids = axis === 0 ? [[s, a, b], [s + 1, a, b]] : axis === 1 ? [[a, s, b], [a, s + 1, b]] : [[a, b, s], [a, b, s + 1]]
      const p0 = node(...ids[0]), p1 = node(...ids[1])
      return [0, 1, 2].map((q) => p0[q] + (p1[q] - p0[q]) * f + gauss(r) * 0.006)
    }],
    [24, (c, count, r) => {
      const p = node(Math.floor(r() * G), Math.floor(r() * G), Math.floor(r() * G))
      return [p[0] + gauss(r) * 0.045, p[1] + gauss(r) * 0.045, p[2] + gauss(r) * 0.045]
    }],
    [10, (i, c, r) => {
      const k = i % PROJECT_NODES.length, p = PROJECT_NODES[k]
      return [...jitter(p, r, 0.055), k]
    }],
  ])
}

/* VanillaKart — a shopping cart with organic traffic climbing out of it.
   Growth-arrow particles: order.y = t along the arrow (a pulse travels up it). */
export const CART_ROT = [0.18, -0.5, 0]
export function cart(n) {
  const T = (p) => rotate(p, ...CART_ROT)
  const ox = -0.55, oy = -0.35
  // basket: a trapezoid box, wider at the top
  const top = 0.45, bot = -0.35, wT = 0.85, wB = 0.62, d = 0.42
  const corner = (sx, sy, sz) => { const w = sy > 0 ? wT : wB; return [ox + sx * w, oy + (sy > 0 ? top : bot), sz * d] }
  const edges = []
  for (const sz of [-1, 1]) {
    edges.push([corner(-1, 1, sz), corner(1, 1, sz)], [corner(-1, -1, sz), corner(1, -1, sz)], [corner(-1, 1, sz), corner(-1, -1, sz)], [corner(1, 1, sz), corner(1, -1, sz)])
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) edges.push([corner(sx, sy, -1), corner(sx, sy, 1)])
  const arrow = [[-1.75, -0.95], [-1.05, -0.45], [-0.55, -0.62], [0.05, 0.05], [0.55, -0.12], [1.3, 0.95]]
  const segLen = arrow.slice(1).map((q, k) => Math.hypot(q[0] - arrow[k][0], q[1] - arrow[k][1]))
  const total = segLen.reduce((a, b) => a + b)
  const along = (t) => {
    let dd = t * total
    for (let k = 0; k < segLen.length; k++) { if (dd <= segLen[k] || k === segLen.length - 1) { const f = Math.min(1, dd / segLen[k]); return [arrow[k][0] + (arrow[k + 1][0] - arrow[k][0]) * f, arrow[k][1] + (arrow[k + 1][1] - arrow[k][1]) * f] } dd -= segLen[k] }
  }
  return compose(n, 171, [
    [26, (i, c, r) => { const [a, b] = edges[i % edges.length]; return T(jitter(lerp3(a, b, r()), r, 0.008)) }],
    [16, (i, c, r) => {
      // mesh on the front face
      const q = r(), sz = 1
      if (q < 0.5) { const k = (Math.floor(r() * 5) + 1) / 6, y = bot + (top - bot) * k, w = wB + (wT - wB) * k; return T(jitter([ox + (r() * 2 - 1) * w, oy + y, sz * d], r, 0.006)) }
      const k = (Math.floor(r() * 5) + 1) / 6 * 2 - 1, t = r(); const w = wB + (wT - wB) * t
      return T(jitter([ox + k * w, oy + bot + (top - bot) * t, sz * d], r, 0.006))
    }],
    [8, (i, c, r) => {
      // handle and wheels
      if (r() < 0.45) { const t = r(); return T(jitter(lerp3([ox - wT, oy + top, 0], [ox - wT - 0.35, oy + top + 0.28, 0], t), r, 0.01)) }
      const side = r() < 0.5 ? -1 : 1, a = r() * TAU
      return T(jitter([ox + side * 0.42 + Math.cos(a) * 0.1, oy + bot - 0.2 + Math.sin(a) * 0.1, (r() < 0.5 ? -1 : 1) * d], r, 0.006))
    }],
    [30, (i, c, r) => { const t = r(); const [x, y] = along(t); return [...T(jitter([x, y, 0.45], r, 0.012)), -1, t] }],
    [8, (i, c, r) => {
      // arrow head
      const t = r(), side = r() < 0.5 ? -1 : 1
      const tip = [1.3, 0.95], dir = [0.75, 1.07].map((v) => v / Math.hypot(0.75, 1.07))
      const back = [tip[0] - dir[0] * 0.32, tip[1] - dir[1] * 0.32]
      const wing = [back[0] - dir[1] * 0.2 * side, back[1] + dir[0] * 0.2 * side]
      return [...T(jitter([tip[0] + (wing[0] - tip[0]) * t, tip[1] + (wing[1] - tip[1]) * t, 0.45], r, 0.01)), -1, 1]
    }],
    [12, (i, c, r) => {
      // products tumbling into the basket
      const k = i % 5, cx = ox - 0.5 + k * 0.25, cy = oy + top + 0.08 + (k % 2) * 0.12
      const e = rectEdge(r, 0.16, 0.16)
      return T(jitter([cx + e[0], cy + e[1], (k - 2) * 0.06], r, 0.006))
    }],
  ])
}

/* Finnfluent (digital finance education) — a megaphone wearing a graduation cap, sending waves and coins out.
   Wave particles: order = (phase, angle, -1, 1); the shader expands them outward. */
export const MEGA_ROT = [0.12, -0.35, 0.08]
export function megaphone(n) {
  const T = (p) => rotate(p, ...MEGA_ROT)
  const x0 = -1.55, x1 = -0.2, r0 = 0.16, r1 = 0.62
  return compose(n, 181, [
    [36, (i, c, r) => {
      // cone: rings + seams
      const q = r(), a = r() * TAU
      if (q < 0.55) { const t = Math.floor(r() * 7) / 6; const rad = r0 + (r1 - r0) * t; return T(jitter([x0 + (x1 - x0) * t, Math.cos(a) * rad, Math.sin(a) * rad], r, 0.008)) }
      if (q < 0.8) { const s = Math.floor(r() * 10) / 10 * TAU, t = r(); const rad = r0 + (r1 - r0) * t; return T(jitter([x0 + (x1 - x0) * t, Math.cos(s) * rad, Math.sin(s) * rad], r, 0.008)) }
      return T(jitter([x1, Math.cos(a) * r1, Math.sin(a) * r1], r, 0.012))
    }],
    [10, (i, c, r) => {
      // mouthpiece and handle
      if (r() < 0.5) { const a = r() * TAU; return T(jitter([x0 - 0.18 + r() * 0.18, Math.cos(a) * 0.1, Math.sin(a) * 0.1], r, 0.006)) }
      const t = r(); return T(jitter(lerp3([x0 + 0.45, -0.3, 0], [x0 + 0.3, -0.75, 0], t), r, 0.02))
    }],
    [16, (i, c, r) => {
      // graduation cap resting on the bell: finance *education*
      const cx = -0.95, top = 0.9, q = r()
      if (q < 0.6) { // mortarboard (a square rotated 45°), tipped towards the viewer so it reads as a cap
        const e = r() < 0.6 ? rectEdge(r, 0.8, 0.8) : [(r() - 0.5) * 0.8, (r() - 0.5) * 0.8], a = Math.PI / 4
        const b = rotate([e[0] * Math.cos(a) - e[1] * Math.sin(a), 0, e[0] * Math.sin(a) + e[1] * Math.cos(a)], 0.7, 0, 0)
        return T(jitter([cx + b[0], top + b[1], b[2]], r, 0.006))
      }
      if (q < 0.85) { const a = r() * TAU; return T(jitter([cx + Math.cos(a) * 0.24, 0.42 + r() * (top - 0.42), Math.sin(a) * 0.24], r, 0.006)) }
      const t = r(); return T(jitter([cx + 0.56 * t, top - (t > 0.75 ? (t - 0.75) * 1.6 : 0), 0.0], r, 0.008)) // tassel
    }],
    [40, (i, c, r) => {
      const ang = (r() * 2 - 1) * 0.75
      return [...T([x1, 0, 0]), (i % 4) / 4 + r() * 0.03, ang, -1, 1]
    }],
    [14, (i, c, r) => {
      // coins carried out on the waves (order = phase, direction, -, 2); p is the coin's local shape
      const k = i % 7, q = r(), a = r() * TAU, R = 0.11
      const d = q < 0.6 ? [Math.cos(a) * R, Math.sin(a) * R, 0] : q < 0.85 ? [Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55, 0] : [(r() - 0.5) * 0.06, (r() - 0.5) * 0.1, 0]
      return [...d, k / 7, (k / 6 - 0.5) * 1.3, -1, 2]
    }],
  ])
}

/* Wave Habitat — an aquarium with sensors and hardware inside, wired to a control panel.
   Stored untilted; the shader animates it and applies AQUA_ROT. order.w: 1 water surface,
   2 plants (x = sway phase), 3 fish (x = index), 4 bubbles (x = phase), 5 cable (x = t), 6 LEDs. */
export const AQUA_ROT = [0.22, -0.5, 0]
export const AQUA = { CX: -0.4, W: 2.4, H: 1.6, D: 1.0, WATER: 0.5, STONE: [0.45, -0.66, 0.15] }
export function aquarium(n) {
  const { CX, W, H, D, WATER } = AQUA
  const x0 = CX - W / 2, x1 = CX + W / 2, y0 = -H / 2, y1 = H / 2, z0 = -D / 2, z1 = D / 2
  const edges = [
    [[x0, y0, z0], [x1, y0, z0]], [[x0, y1, z0], [x1, y1, z0]], [[x0, y0, z1], [x1, y0, z1]], [[x0, y1, z1], [x1, y1, z1]],
    [[x0, y0, z0], [x0, y1, z0]], [[x1, y0, z0], [x1, y1, z0]], [[x0, y0, z1], [x0, y1, z1]], [[x1, y0, z1], [x1, y1, z1]],
    [[x0, y0, z0], [x0, y0, z1]], [[x1, y0, z0], [x1, y0, z1]], [[x0, y1, z0], [x0, y1, z1]], [[x1, y1, z0], [x1, y1, z1]],
  ]
  const dev = [x1 - 0.35, y1 + 0.08, z0 + 0.05] // controller clipped to the back rim
  const panel = [1.55, 0.05, 0]
  const cableA = [dev[0] + 0.15, dev[1] + 0.05, dev[2]], cableB = [panel[0] - 0.3, panel[1] + 0.42, 0]
  const cable = (t) => { const p = lerp3(cableA, cableB, t); p[1] += Math.sin(Math.PI * t) * 0.25; return p }
  return compose(n, 191, [
    [16, (i, c, r) => { const [a, b] = edges[i % edges.length]; return jitter(lerp3(a, b, r()), r, 0.006) }],
    [18, (i, c, r) => [x0 + 0.05 + r() * (W - 0.1), WATER, z0 + 0.05 + r() * (D - 0.1), -1, -1, -1, 1]],
    [10, (i, c, r) => { // gravel
      const x = x0 + 0.03 + r() * (W - 0.06), z = z0 + 0.03 + r() * (D - 0.06)
      return [x, y0 + 0.03 + Math.abs(Math.sin(x * 7) * Math.cos(z * 9)) * 0.1 * r(), z]
    }],
    [6, (i, c, r) => { // swaying plants rooted in the gravel
      const k = i % 5, bx = x0 + 0.3 + k * 0.42, bz = [0.1, -0.25, 0.25, -0.1, 0.2][k], t = r(), h = [0.8, 0.55, 0.95, 0.6, 0.75][k]
      return [bx + gauss(r) * 0.02, y0 + 0.08 + t * h, bz + gauss(r) * 0.02, k * 1.3, -1, -1, 2]
    }],
    [18, (i, c, r) => { // fish: a body and a tail, in local coords; the shader swims them
      const k = i % 4, q = r(), sc = [1.5, 1.25, 1.1, 1.35][k]
      let d
      if (q < 0.72) { const a = r() * TAU, rr = Math.sqrt(r()); d = [Math.cos(a) * 0.13 * rr, Math.sin(a) * 0.06 * rr, gauss(r) * 0.012] }
      else { const t = r(), s2 = (r() * 2 - 1) * t; d = [-0.12 - t * 0.1, s2 * 0.07, 0] }
      return [d[0] * sc, d[1] * sc, d[2] * sc, k, -1, -1, 3]
    }],
    [8, (i, c, r) => [0, 0, 0, r(), -1, -1, 4]], // bubbles from the air stone
    [6, (i, c, r) => { // hardware: controller box on the rim + sensor probe into the water + air stone
      const q = r()
      if (q < 0.45) { const e = rectEdge(r, 0.36, 0.2); return jitter([dev[0] + e[0], dev[1] + e[1], dev[2]], r, 0.005) }
      if (q < 0.62) { const t = r(); return jitter([dev[0] - 0.08, dev[1] - 0.1 - t * 0.95, dev[2] + 0.05], r, 0.004) }
      const a = r() * TAU; return jitter([AQUA.STONE[0] + Math.cos(a) * 0.08, AQUA.STONE[1], AQUA.STONE[2] + Math.sin(a) * 0.05], r, 0.01)
    }],
    [3, (i, c, r) => [dev[0] + (i % 2 ? 0.1 : 0.03), dev[1] + 0.02, dev[2] + 0.01, i % 2, -1, -1, 6]], // LEDs
    [6, (i, c, r) => { const t = r(); return [...jitter(cable(t), r, 0.006), t, -1, -1, 5] }],
    [9, (i, c, r) => { // control panel: frame, three sliders with knobs, a temperature readout
      const q = r(), [px, py] = panel
      if (q < 0.4) { const e = rectEdge(r, 0.62, 0.95); return jitter([px + e[0], py + e[1], 0], r, 0.005) }
      if (q < 0.75) { const k = Math.floor(r() * 3), y = py + 0.22 - k * 0.2; return jitter([px - 0.2 + r() * 0.4, y, 0], r, 0.004) }
      if (q < 0.88) { const k = Math.floor(r() * 3), y = py + 0.22 - k * 0.2, kx = px - 0.2 + [0.3, 0.12, 0.26][k]; return jitter([kx, y, 0], r, 0.03) }
      const t = r(); return jitter([px - 0.2 + t * 0.4, py + 0.36, 0], r, 0.012)
    }],
  ])
}

/* Portfolio v1 "Universe" — a small solar system, a nod to the old site.
   Stored untilted; the shader orbits the planets and applies SOLAR_ROT.
   Planets: order = (orbit radius, start angle, speed, 1). Sun: order.w = 2. */
export const SOLAR_ROT = [0.5, 0, 0.18]
const ORBITS = [[0.8, 0.07, 0.5], [1.15, 0.1, 0.36], [1.55, 0.13, 0.27], [1.95, 0.2, 0.19], [2.35, 0.15, 0.13]]
export function solar(n) {
  return compose(n, 161, [
    [22, (i, c, r) => {
      const d = randomOnSphere(r), k = 0.42 * Math.pow(r(), 0.35)
      return [d[0] * k, d[1] * k, d[2] * k, -1, -1, -1, 2]
    }],
    [40, (i, c, r) => {
      const o = ORBITS[i % ORBITS.length], a = r() * TAU
      return [Math.cos(a) * o[0], gauss(r) * 0.006, Math.sin(a) * o[0]]
    }],
    [38, (i, c, r) => {
      const k = i % ORBITS.length, o = ORBITS[k]
      let d
      if (k === 3 && r() < 0.45) { const a = r() * TAU, rr = o[1] * (1.6 + r() * 0.7); d = rotate([Math.cos(a) * rr, 0, Math.sin(a) * rr], 0.35, 0, 0.2) }
      else d = randomOnSphere(r).map((v) => v * o[1] * Math.cbrt(r()))
      return [...d, o[0], k * 1.3 + 0.4, o[2], 1]
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
let landBits = null, landCells = null, coastCells = null
function landAt(x, y) {
  x = (x + LAND_W) % LAND_W
  if (y < 0 || y >= LAND_H) return 0
  const i = y * LAND_W + x
  return (landBits[i >> 3] >> (i & 7)) & 1
}
function buildLand() {
  if (landCells) return
  landBits = Uint8Array.from(atob(LAND_B64), (c) => c.charCodeAt(0))
  landCells = []; coastCells = []
  for (let y = 0; y < LAND_H; y++) for (let x = 0; x < LAND_W; x++) {
    if (!landAt(x, y)) continue
    landCells.push(y * LAND_W + x)
    if (!landAt(x - 1, y) || !landAt(x + 1, y) || !landAt(x, y - 1) || !landAt(x, y + 1)) coastCells.push(y * LAND_W + x)
  }
}
// a random point inside a random cell of `cells`, area-weighted (cells near the poles are smaller)
function sampleCell(cells, r) {
  for (let tries = 0; tries < 30; tries++) {
    const id = cells[Math.floor(r() * cells.length)]
    const cx = id % LAND_W, cy = Math.floor(id / LAND_W)
    const lat = 90 - ((cy + r()) / LAND_H) * 180, lon = -180 + ((cx + r()) / LAND_W) * 360
    if (r() < Math.cos(lat * DEG)) return [lat, lon]
  }
  return [0, 0]
}
const HUBS = [[37.77, -122.42], [40.71, -74.0], [51.5, -0.12], [52.52, 13.4], [1.35, 103.82], [35.68, 139.69], [-33.87, 151.21], [25.2, 55.27], [12.97, 77.59]]
export function arcPoint(a, b, t, lift = 0.32) {
  const x = a[0] * (1 - t) + b[0] * t, y = a[1] * (1 - t) + b[1] * t, z = a[2] * (1 - t) + b[2] * t
  const l = Math.hypot(x, y, z) || 1
  const h = GLOBE_R * (1 + Math.sin(Math.PI * t) * lift)
  return [(x / l) * h, (y / l) * h, (z / l) * h]
}
/* Globe from a 0.5° Natural Earth land mask: filled continents, a crisp bright coastline,
   a faint graticule and arcs from home. order.x: 1 = coast (glows), 2 = graticule (faint). */
export function globe(n) {
  buildLand()
  const R = GLOBE_R
  const home = latLon(HOME.lat, HOME.lon, 1)
  const hubs = HUBS.map(([la, lo]) => latLon(la, lo, 1))
  return compose(n, 81, [
    [66, (i, c, r) => latLon(...sampleCell(landCells, r), R)],
    [24, (i, c, r) => [...latLon(...sampleCell(coastCells, r), R * 1.002), 1]],
    [6, (i, c, r) => {
      const p = r() < 0.5 ? latLon((Math.floor(r() * 11) - 5) * 15, r() * 360 - 180, R * 0.998) : latLon(r() * 170 - 85, Math.floor(r() * 24) * 15 - 180, R * 0.998)
      return [...p, 2]
    }],
    [4, (i, c, r) => arcPoint(home, hubs[i % hubs.length], r())],
  ])
}

// order matters: it is the order of the chapters on the page
export const SHAPES = [neuralSphere, monogram, helix, pipeline, stack, chip, cart, megaphone, candles, leaf, book, aquarium, solar, lattice, globe]
