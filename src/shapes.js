// Point-cloud generators. Each returns a Float32Array of exactly `n` xyz points,
// roughly fitting inside a radius of ~2.2 units around the origin.

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

function gauss(r) {
  return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(TAU * r())
}

function randomOnSphere(r) {
  const u = r() * 2 - 1
  const t = r() * TAU
  const s = Math.sqrt(1 - u * u)
  return [s * Math.cos(t), u, s * Math.sin(t)]
}

// Fill `out` by calling parts in proportion. parts: [[weight, fn(i, r) => [x,y,z]], ...]
function compose(n, seed, parts) {
  const r = rng(seed)
  const out = new Float32Array(n * 3)
  const total = parts.reduce((a, p) => a + p[0], 0)
  let i = 0
  parts.forEach(([w, fn], k) => {
    const count = k === parts.length - 1 ? n - i : Math.round((w / total) * n)
    for (let c = 0; c < count && i < n; c++, i++) {
      const p = fn(c, count, r)
      out[i * 3] = p[0]
      out[i * 3 + 1] = p[1]
      out[i * 3 + 2] = p[2]
    }
  })
  return out
}

function rotate(p, ax, ay, az = 0) {
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
      // fibonacci shell with slight radial breathing
      const y = 1 - (i / (count - 1)) * 2
      const rad = Math.sqrt(1 - y * y)
      const th = i * 2.399963
      const k = R * (1 + gauss(r) * 0.015)
      return [Math.cos(th) * rad * k, y * k, Math.sin(th) * rad * k]
    }],
    [15, (i, c, r) => {
      // dense synapse clusters on the surface
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

/* 1 — "DN" monogram sampled from text */
export function monogram(n, text = 'DN') {
  const W = 640, H = 300
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = "italic 400 270px 'Instrument Serif', 'Times New Roman', serif"
  ctx.fillText(text, W / 2, H / 2 + 10)
  const data = ctx.getImageData(0, 0, W, H).data
  const pts = []
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      if (data[(y * W + x) * 4 + 3] > 128) pts.push(x, y)
    }
  }
  const scale = 4.4 / W
  return compose(n, 21, [
    [100, (i, c, r) => {
      if (!pts.length) return randomOnSphere(r)
      const k = Math.floor(r() * (pts.length / 2)) * 2
      const x = (pts[k] + r() * 2 - W / 2) * scale
      const y = -(pts[k + 1] + r() * 2 - H / 2) * scale
      return [x, y, gauss(r) * 0.08]
    }],
  ])
}

/* 2 — Double helix (data pipelines) */
export function helix(n) {
  const L = 1.75, R = 0.55, turns = 2.2
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

/* 3 — Candlestick chart (stock prediction) */
export function candles(n) {
  const r0 = rng(99)
  const count = 18
  const series = []
  let price = 0
  for (let i = 0; i < count; i++) {
    const open = price
    price += (r0() - 0.42) * 0.55
    const close = price
    const hi = Math.max(open, close) + r0() * 0.25
    const lo = Math.min(open, close) - r0() * 0.25
    series.push({ open, close, hi, lo })
  }
  const min = Math.min(...series.map((s) => s.lo))
  const max = Math.max(...series.map((s) => s.hi))
  const ny = (v) => ((v - min) / (max - min)) * 2.6 - 1.3
  const W = 3.3, bw = 0.1
  const tilt = (p) => rotate(p, 0.1, -0.28)
  return compose(n, 41, [
    [72, (i, c, r) => {
      const k = Math.floor(r() * count)
      const s = series[k]
      const x = (k / (count - 1)) * W - W / 2
      let a = ny(Math.min(s.open, s.close)), b = ny(Math.max(s.open, s.close))
      if (b - a < 0.05) b = a + 0.05
      // points on the surface of the candle body
      const face = r()
      let px = (r() * 2 - 1) * bw, pz = (r() * 2 - 1) * bw
      if (face < 0.5) px = Math.sign(px) * bw
      else pz = Math.sign(pz) * bw
      return tilt([x + px, a + r() * (b - a), pz])
    }],
    [16, (i, c, r) => {
      const k = Math.floor(r() * count)
      const s = series[k]
      const x = (k / (count - 1)) * W - W / 2
      return tilt([x + gauss(r) * 0.008, ny(s.lo) + r() * (ny(s.hi) - ny(s.lo)), gauss(r) * 0.008])
    }],
    [12, (i, c, r) => {
      // moving-average trend line floating in front
      const t = r() * (count - 1)
      const k = Math.floor(t), f = t - k
      const v = (j) => { const s = series[Math.min(count - 1, j)]; return (s.open + s.close) / 2 }
      const y = ny(v(k) * (1 - f) + v(k + 1) * f)
      return tilt([(t / (count - 1)) * W - W / 2, y + gauss(r) * 0.012, 0.35 + gauss(r) * 0.012])
    }],
  ])
}

/* 4 — Leaf (biomass estimation) */
export function leaf(n) {
  const len = 3.6
  const halfW = (t) => 1.0 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.85)), 1.1) * (1 - 0.25 * t)
  const place = (t, s) => {
    // t: 0 (base) → 1 (tip); s: -1..1 across the blade
    const w = halfW(t)
    const x = s * w
    const y = t * len - len / 2
    const z = 0.28 * s * s - 0.35 * Math.sin(Math.PI * t) * 0.6 + 0.2 * t * t
    return rotate([x, y, z], -0.45, 0.35, -0.55)
  }
  return compose(n, 51, [
    [52, (i, c, r) => place(r(), (r() * 2 - 1) * 0.98)],
    [14, (i, c, r) => place(r(), r() < 0.5 ? -1 : 1)],
    [10, (i, c, r) => { const p = place(r(), 0); return [p[0] + gauss(r) * 0.012, p[1], p[2] + gauss(r) * 0.012] }],
    [20, (i, c, r) => {
      // veins: from the midrib toward the edge, angled toward the tip
      const v = Math.floor(r() * 16)
      const side = v % 2 ? 1 : -1
      const t0 = 0.08 + (Math.floor(v / 2) / 8) * 0.8
      const s = r()
      return place(Math.min(1, t0 + s * 0.16), side * s * 0.95)
    }],
    [4, (i, c, r) => { const t = -r() * 0.12; return rotate([gauss(r) * 0.01, t * len - len / 2, 0], -0.45, 0.35, -0.55) }],
  ])
}

/* 5 — Open book (education platform) */
export function book(n) {
  const H = 1.1, Wd = 1.35
  // pages rise out of the spine and curl gently back down at the fore-edge
  const page = (u, v, side, layer) => {
    const lift = 0.62 * Math.sin(Math.min(1, u) * Math.PI * 0.62)
    const x = side * (0.03 + u * Wd * (1 - layer * 0.012))
    const z = lift - layer * 0.045 * Math.pow(u, 0.6)
    return rotate([x, v * H, z], -0.95, side * 0.02 + 0.28, 0.08)
  }
  return compose(n, 61, [
    [42, (i, c, r) => page(r(), r() * 2 - 1, r() < 0.5 ? -1 : 1, 0)],
    [22, (i, c, r) => page(r(), r() < 0.5 ? -1 : 1, r() < 0.5 ? -1 : 1, Math.floor(r() * 7))],
    [16, (i, c, r) => page(1, r() * 2 - 1, r() < 0.5 ? -1 : 1, Math.floor(r() * 7))],
    [20, (i, c, r) => {
      // lines of "text"
      const side = r() < 0.5 ? -1 : 1
      const row = Math.floor(r() * 12)
      const v = 0.78 - (row / 11) * 1.56
      const u = 0.12 + r() * (row % 4 === 3 ? 0.4 : 0.74)
      const p = page(u, v, side, 0)
      return [p[0], p[1], p[2] + 0.012]
    }],
  ])
}

/* 6 — Skill lattice */
export function lattice(n) {
  const g = 4, S = 2.0
  const node = (i, j, k) => [(i / (g - 1) - 0.5) * S, (j / (g - 1) - 0.5) * S, (k / (g - 1) - 0.5) * S]
  return compose(n, 71, [
    [70, (c, count, r) => {
      const axis = Math.floor(r() * 3)
      const a = Math.floor(r() * g), b = Math.floor(r() * g), s = Math.floor(r() * (g - 1))
      const f = r()
      const ids = axis === 0 ? [[s, a, b], [s + 1, a, b]] : axis === 1 ? [[a, s, b], [a, s + 1, b]] : [[a, b, s], [a, b, s + 1]]
      const p0 = node(...ids[0]), p1 = node(...ids[1])
      return [p0[0] + (p1[0] - p0[0]) * f + gauss(r) * 0.006, p0[1] + (p1[1] - p0[1]) * f + gauss(r) * 0.006, p0[2] + (p1[2] - p0[2]) * f + gauss(r) * 0.006]
    }],
    [30, (c, count, r) => {
      const p = node(Math.floor(r() * g), Math.floor(r() * g), Math.floor(r() * g))
      const s = 0.045
      return [p[0] + gauss(r) * s, p[1] + gauss(r) * s, p[2] + gauss(r) * s]
    }],
  ])
}

/* 7 — Globe with connection arcs */
export function globe(n) {
  const R = 1.55
  const land = (p) => {
    const [x, y, z] = p
    return Math.sin(x * 3.1 + 1.3) * Math.sin(y * 2.7 + 0.4) * Math.sin(z * 3.3 + 2.1) +
      0.5 * Math.sin(x * 6.3 + z * 4.1) * Math.sin(y * 5.7 - 1.0)
  }
  const r0 = rng(83)
  const arcs = []
  for (let i = 0; i < 12; i++) arcs.push([randomOnSphere(r0), randomOnSphere(r0)])
  return compose(n, 81, [
    [58, (i, c, r) => {
      let p
      for (let tries = 0; tries < 30; tries++) {
        p = randomOnSphere(r)
        if (land(p) > 0.12) break
      }
      return [p[0] * R, p[1] * R, p[2] * R]
    }],
    [24, (i, c, r) => {
      if (r() < 0.5) {
        // latitude lines
        const lat = (Math.floor(r() * 7) - 3) * (Math.PI / 8)
        const a = r() * TAU
        return [Math.cos(lat) * Math.cos(a) * R, Math.sin(lat) * R, Math.cos(lat) * Math.sin(a) * R]
      }
      const lon = Math.floor(r() * 12) * (Math.PI / 12)
      const a = r() * TAU
      return [Math.cos(a) * Math.cos(lon) * R, Math.sin(a) * R, Math.cos(a) * Math.sin(lon) * R]
    }],
    [14, (i, c, r) => {
      const [a, b] = arcs[i % arcs.length]
      const t = r()
      // slerp-ish then lift off the surface
      const x = a[0] * (1 - t) + b[0] * t, y = a[1] * (1 - t) + b[1] * t, z = a[2] * (1 - t) + b[2] * t
      const l = Math.hypot(x, y, z) || 1
      const h = R * (1 + Math.sin(Math.PI * t) * 0.35)
      return [(x / l) * h, (y / l) * h, (z / l) * h]
    }],
  ])
}

export const SHAPES = [neuralSphere, monogram, helix, candles, leaf, book, lattice, globe]
// Shapes that slowly spin around their own Y axis (the rest stay readable, facing the camera)
export const SPIN = [1, 0, 0, 0, 0, 0, 1, 1]
