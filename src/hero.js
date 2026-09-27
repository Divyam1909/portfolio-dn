// The intro model cycles through seven forms. Each generator returns { pos, order } like shapes.js,
// with order = (tint, a, b, part):
//   tint  0 primary colour · 1 secondary colour · 2 neutral (silver/white) · 3 dark · 4 glowing accent
//   part  animation group read by the shader (see heroAnim in scene.js); a/b are its parameters.
// All forms are built upright and untilted, roughly within a radius of 2.1.

import { compose, gauss, randomOnSphere, rotate, neuralSphere } from './shapes.js'

const TAU = Math.PI * 2
const lerp = (a, b, t) => a + (b - a) * t
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
const jit = (p, r, s) => [p[0] + gauss(r) * s, p[1] + gauss(r) * s, p[2] + gauss(r) * s]
const O = (p, tint, a = -1, b = -1, part = 0) => [p[0], p[1], p[2], tint, a, b, part]

// surface of an ellipsoid
const ell = (r, c, s) => { const d = randomOnSphere(r); return [c[0] + d[0] * s[0], c[1] + d[1] * s[1], c[2] + d[2] * s[2]] }

// a point on a box: `edge` share of points on the 12 edges (crisp mecha look), the rest on faces
function box(r, c, s, edge = 0.45) {
  const h = [s[0] / 2, s[1] / 2, s[2] / 2]
  if (r() < edge) {
    const axis = Math.floor(r() * 3), sgn = () => (r() < 0.5 ? -1 : 1)
    const p = [sgn() * h[0], sgn() * h[1], sgn() * h[2]]
    p[axis] = (r() * 2 - 1) * h[axis]
    return [c[0] + p[0], c[1] + p[1], c[2] + p[2]]
  }
  const areas = [s[1] * s[2], s[0] * s[2], s[0] * s[1]], tot = areas[0] + areas[1] + areas[2]
  let q = r() * tot, axis = 0
  while (q > areas[axis]) { q -= areas[axis]; axis++ }
  const p = [(r() * 2 - 1) * h[0], (r() * 2 - 1) * h[1], (r() * 2 - 1) * h[2]]
  p[axis] = (r() < 0.5 ? -1 : 1) * h[axis]
  return [c[0] + p[0], c[1] + p[1], c[2] + p[2]]
}

// surface of a tapered tube from a to b
function tube(r, a, b, ra, rb) {
  const t = r(), ang = r() * TAU
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d) || 1
  const u = d.map((v) => v / L)
  const ref = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const e1 = [u[1] * ref[2] - u[2] * ref[1], u[2] * ref[0] - u[0] * ref[2], u[0] * ref[1] - u[1] * ref[0]]
  const l1 = Math.hypot(...e1); e1.forEach((v, k) => (e1[k] = v / l1))
  const e2 = [u[1] * e1[2] - u[2] * e1[1], u[2] * e1[0] - u[0] * e1[2], u[0] * e1[1] - u[1] * e1[0]]
  const rad = lerp(ra, rb, t), c = lerp3(a, b, t)
  return [0, 1, 2].map((k) => c[k] + (e1[k] * Math.cos(ang) + e2[k] * Math.sin(ang)) * rad)
}

/* 1 — Golden eagle, soaring with spread wings and splayed primary feathers */
export function eagle(n) {
  const SPAN = 2.1
  // wing surface point: s = distance from body (0.18 … SPAN), f = 0 leading … 1 trailing edge
  const wing = (s, f, side) => {
    const k = (s - 0.18) / (SPAN - 0.18)
    // broad, nearly rectangular soaring wing: straight-ish leading edge, slight taper, bulging secondaries
    const le = 0.3 + 0.1 * k - 0.18 * k * k * k
    const te = -0.45 - 0.2 * Math.sin(Math.PI * Math.min(1, k * 1.4)) + 0.28 * k * k * k
    const y = lerp(le, te, f)
    const z = 0.1 * k + 0.12 * k * k - 0.05 * Math.sin(Math.PI * f) // dihedral + camber
    return [side * s, y, z]
  }
  return compose(n, 301, [
    [34, (i, c, r) => { // inner wing (brown, gold-edged)
      const side = r() < 0.5 ? -1 : 1, s = lerp(0.18, 1.6, Math.sqrt(r())), f = r()
      return O(jit(wing(s, f, side), r, 0.012), f < 0.55 ? 0 : 3, -1, -1, 1)
    }],
    [10, (i, c, r) => { // leading and trailing edges, for a crisp outline
      const side = r() < 0.5 ? -1 : 1, s = lerp(0.18, 1.62, r()), f = r() < 0.5 ? 0 : 1
      return O(jit(wing(s, f, side), r, 0.008), f ? 3 : 0, -1, -1, 1)
    }],
    [14, (i, c, r) => { // seven splayed primary feathers at each wing tip
      const side = r() < 0.5 ? -1 : 1, k = Math.floor(r() * 7), t = r()
      const base = wing(1.52, 0.08 + k * 0.13, side)
      const ang = 0.3 - k * 0.11, len = 0.55 + 0.12 * Math.sin((k / 6) * Math.PI)
      const w = (r() - 0.5) * 0.055 * (1 - t * 0.6)
      return O(jit([base[0] + side * Math.cos(ang) * len * t - side * Math.sin(ang) * w, base[1] + Math.sin(ang) * len * t + Math.cos(ang) * w, base[2] + 0.06 * t], r, 0.006), 3, -1, -1, 1)
    }],
    [12, (i, c, r) => { // body
      const p = ell(r, [0, -0.05, 0], [0.22, 0.62, 0.22])
      return O(jit(p, r, 0.006), p[1] > 0.3 ? 0 : 3)
    }],
    [6, (i, c, r) => { // head and golden nape
      const p = ell(r, [0, 0.72, 0.04], [0.17, 0.2, 0.17])
      return O(jit(p, r, 0.005), p[1] > 0.66 ? 1 : 0)
    }],
    [3, (i, c, r) => { // hooked beak
      const t = r(), a = r() * TAU, rad = 0.06 * (1 - t)
      const x = Math.cos(a) * rad, y = 0.72 - t * t * 0.14, z = 0.18 + t * 0.18
      return O([x, y + Math.sin(a) * rad * 0.7, z], 1)
    }],
    [1, (i, c, r) => O(jit([(i % 2 ? 1 : -1) * 0.075, 0.76, 0.18], r, 0.012), 4)], // eyes
    [12, (i, c, r) => { // fanned tail
      const t = r(), s = (r() * 2 - 1), w = lerp(0.14, 0.48, t)
      const edge = r() < 0.3
      return O(jit([s * w * (edge ? Math.sign(s) || 1 : 1), -0.6 - t * 0.62 - (edge ? 0 : 0) + (1 - s * s) * 0.05 * t, -0.04], r, 0.008), t > 0.82 ? 2 : 3)
    }],
    [4, (i, c, r) => { // talons tucked under the tail
      const side = i % 2 ? 1 : -1, t = r()
      return O(jit([side * 0.1, -0.55 - t * 0.12, 0.12 + Math.sin(t * 3) * 0.05], r, 0.02), 1)
    }],
    [2, (i, c, r) => { const d = randomOnSphere(r), k = 1.4 + r() * 1.0; return O([d[0] * k, d[1] * k * 0.6, d[2] * k * 0.5], 4, r(), -1, 8) }], // golden sparks
  ])
}

/* 2 — Rocket, rolling slowly with a live exhaust plume */
export function rocket(n) {
  const Y0 = 0.3 // everything shifted up so the plume fits
  const R = 0.42
  const prof = (y) => { // radius at height y (without the offset)
    if (y > 0.9) return R * Math.sqrt(Math.max(0, (1.6 - y) / 0.7)) * (1 - 0.15 * ((y - 0.9) / 0.7))
    if (y > -0.9) return R
    if (y > -1.05) return lerp(R, 0.3, (-0.9 - y) / 0.15)
    return lerp(0.18, 0.3, (y + 1.35) / 0.3) // nozzle bell
  }
  return compose(n, 311, [
    [34, (i, c, r) => { // hull
      const y = lerp(-1.35, 1.6, r()), a = r() * TAU, rr = prof(y)
      const tint = y > 0.9 || (y > 0.48 && y < 0.6) || (y < -0.55 && y > -0.68) ? 1 : y < -1.05 ? 3 : 2
      return O(jit([Math.cos(a) * rr, y + Y0, Math.sin(a) * rr], r, 0.005), tint)
    }],
    [12, (i, c, r) => { // panel rings
      const ys = [1.2, 0.9, 0.6, 0.48, 0.1, -0.3, -0.55, -0.68, -0.9, -1.05]
      const y = ys[i % ys.length], a = r() * TAU, rr = prof(y) * 1.01
      return O([Math.cos(a) * rr, y + Y0, Math.sin(a) * rr], y > 0.45 && y < 0.62 ? 1 : 2)
    }],
    [5, (i, c, r) => { // porthole facing the viewer
      const a = r() * TAU, rw = 0.13 * (r() < 0.6 ? 1 : Math.sqrt(r()))
      const x = Math.cos(a) * rw, y = 0.28 + Math.sin(a) * rw
      return O([x, y + Y0, Math.sqrt(Math.max(0, R * R - x * x)) + 0.01], rw > 0.12 ? 2 : 4)
    }],
    [14, (i, c, r) => { // four fins
      const k = i % 4, ang = (k / 4) * TAU + Math.PI / 4
      const t = r(), f = r()
      const rootTop = -0.35, rootBot = -1.05, tipTop = -0.95, tipBot = -1.3
      const rad = lerp(R, 0.98, t)
      const y = lerp(lerp(rootTop, tipTop, t), lerp(rootBot, tipBot, t), f)
      const edge = r() < 0.4
      const yy = edge ? lerp(rootTop, tipTop, t) : y
      return O(jit([Math.cos(ang) * rad, yy + Y0, Math.sin(ang) * rad], r, 0.006), 1)
    }],
    [35, (i, c, r) => { // exhaust plume (animated): a = angle, b = radial fraction
      return O([0, -1.35 + Y0, 0], 0, r(), Math.sqrt(r()), 2)
    }],
  ])
}

/* 3 — The neural sphere (existing), with glowing synapse clusters */
export function neural(n) {
  const s = neuralSphere(n)
  const order = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) {
    const x = s.pos[i * 3], y = s.pos[i * 3 + 1], z = s.pos[i * 3 + 2]
    const rad = Math.hypot(x, y, z)
    order.set([rad > 1.6 ? 0 : (i * 7919) % 100 < 22 ? 0 : 2, -1, -1, 7], i * 4)
  }
  return { pos: s.pos, order }
}

/* 4 — A heroic transforming robot: red cab-chest with windows, blue legs, silver details */
export function robot(n) {
  const B = [ // [centre, size, tint, weight]
    [[0, 1.52, 0], [0.34, 0.36, 0.3], 1, 3], // helmet
    [[0, 1.47, 0.16], [0.2, 0.2, 0.03], 2, 1], // face plate
    [[-0.215, 1.6, 0], [0.05, 0.3, 0.07], 1, 0.6], [[0.215, 1.6, 0], [0.05, 0.3, 0.07], 1, 0.6], // antennae
    [[0, 1.72, 0.08], [0.07, 0.1, 0.06], 1, 0.4], // crest
    [[0, 1.3, 0], [0.16, 0.1, 0.16], 2, 0.5], // neck
    [[0, 0.95, 0], [1.1, 0.62, 0.5], 0, 7], // chest
    [[0, 0.7, 0.26], [0.32, 0.18, 0.02], 2, 0.8], // grille
    [[-0.62, 1.28, -0.16], [0.08, 0.52, 0.08], 2, 0.7], [[0.62, 1.28, -0.16], [0.08, 0.52, 0.08], 2, 0.7], // smokestacks
    [[-0.74, 1.05, 0], [0.34, 0.34, 0.44], 0, 2], [[0.74, 1.05, 0], [0.34, 0.34, 0.44], 0, 2], // shoulders
    [[-0.8, 0.62, 0], [0.22, 0.5, 0.24], 2, 1.6], [[0.8, 0.62, 0], [0.22, 0.5, 0.24], 2, 1.6], // upper arms
    [[-0.82, 0.08, 0.05], [0.3, 0.62, 0.32], 0, 2.4], [[0.82, 0.08, 0.05], [0.3, 0.62, 0.32], 0, 2.4], // forearms
    [[-0.82, -0.34, 0.08], [0.24, 0.22, 0.26], 1, 1], [[0.82, -0.34, 0.08], [0.24, 0.22, 0.26], 1, 1], // fists
    [[0, 0.48, 0], [0.62, 0.36, 0.36], 2, 2], // abdomen
    [[0, 0.18, 0], [0.8, 0.24, 0.44], 1, 2], // pelvis
    [[-0.26, -0.27, 0], [0.3, 0.62, 0.34], 2, 2], [[0.26, -0.27, 0], [0.3, 0.62, 0.34], 2, 2], // thighs
    [[-0.3, -1.06, 0.02], [0.42, 0.95, 0.46], 1, 4.5], [[0.3, -1.06, 0.02], [0.42, 0.95, 0.46], 1, 4.5], // shins
    [[-0.3, -1.66, 0.12], [0.46, 0.2, 0.66], 1, 1.8], [[0.3, -1.66, 0.12], [0.46, 0.2, 0.66], 1, 1.8], // feet
  ]
  const tot = B.reduce((a, b) => a + b[3], 0)
  const pick = (r) => { let q = r() * tot; for (const b of B) { if ((q -= b[3]) <= 0) return b } return B[0] }
  return compose(n, 321, [
    [86, (i, c, r) => { const [ce, sz, tint] = pick(r); return O(jit(box(r, ce, sz), r, 0.004), tint) }],
    [7, (i, c, r) => { // chest windows (glowing blue)
      const side = r() < 0.5 ? -1 : 1
      const p = box(r, [side * 0.27, 1.02, 0.255], [0.42, 0.34, 0.001], 0.5)
      return O(p, 4)
    }],
    [2, (i, c, r) => O(jit([(r() - 0.5) * 0.17, 1.53, 0.18], r, 0.006), 4)], // visor eyes
    [5, (i, c, r) => { // shin wheels
      const side = r() < 0.5 ? -1 : 1, a = r() * TAU, rr = r() < 0.6 ? 0.17 : 0.09
      return O([side * 0.52, -0.95 + Math.cos(a) * rr, Math.sin(a) * rr], 3)
    }],
  ])
}

/* 5 — Blue whale: long streamlined body, throat grooves, pectoral fins, flukes.
   Body particles carry a = u (0 tail … 1 head) so the shader can swim the tail. */
export function whale(n) {
  const L = 4.3, X0 = -L / 2
  const rad = (u) => 0.66 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.pow(u, 0.55) * 0.97 + 0.03)), 0.7) * (u > 0.7 ? 1 + (u - 0.7) * 0.25 : 1)
  const body = (u, ang, k = 1) => {
    const rr = rad(u) * k
    const flat = u > 0.82 ? lerp(0.85, 0.6, (u - 0.82) / 0.18) : 0.85
    return [X0 + u * L, Math.sin(ang) * rr * flat, Math.cos(ang) * rr]
  }
  return compose(n, 331, [
    [52, (i, c, r) => { const u = r(), ang = r() * TAU; const p = body(u, ang); return O(jit(p, r, 0.006), Math.sin(ang) < -0.35 ? 2 : 0, u, -1, 3) }],
    [10, (i, c, r) => { // throat grooves
      const u = lerp(0.62, 0.97, r()), g = Math.floor(r() * 7), ang = -Math.PI / 2 + (g - 3) * 0.16
      return O(body(u, ang, 1.01), 2, u, -1, 3)
    }],
    [8, (i, c, r) => { // pectoral fins, swept back and down
      const side = r() < 0.5 ? -1 : 1, t = r(), w = (r() - 0.5) * 0.12 * (1 - t)
      const root = body(0.72, -0.6 * side + (side > 0 ? 0 : Math.PI), 0.9)
      return O(jit([root[0] - t * 0.55 + w, root[1] - t * 0.28, root[2] + side * t * 0.35], r, 0.01), 0, 0.72, -1, 3)
    }],
    [3, (i, c, r) => { const t = r(); return O(jit([X0 + L * 0.24 - t * 0.12, rad(0.24) * 0.85 + t * 0.12 * (1 - t) * 2, 0], r, 0.01), 0, 0.24, -1, 3) }], // dorsal fin
    [12, (i, c, r) => { // flukes, horizontal
      const side = r() < 0.5 ? -1 : 1, t = r(), f = r()
      const z = side * t * 0.8
      const x = X0 - 0.05 - t * 0.28 - f * lerp(0.18, 0.05, t) + t * t * 0.1
      return O(jit([x, 0, z], r, 0.008), f > 0.85 ? 2 : 0, 0, -1, 3)
    }],
    [1, (i, c, r) => O(jit(body(0.86, 0.15 * (i % 2 ? 1 : -1) + (i % 2 ? 0 : Math.PI) - 0.2, 1.02), r, 0.01), 3, 0.86, -1, 3)], // eyes
    [8, (i, c, r) => { // spout from the blowhole (animated): a = phase, b = angle
      const top = body(0.84, Math.PI / 2)
      return O([top[0], top[1], top[2]], 1, r(), r() * TAU, 9)
    }],
  ])
}

/* 6 — Tiger, walking in profile: striped body, white belly and muzzle, curling tail */
export function tiger(n) {
  const stripe = (p) => Math.sin(p[0] * 10 + Math.sin(p[1] * 6 + p[2] * 3) * 1.4) > 0.55
  const shade = (p, belly = -0.15) => (p[1] < belly ? 2 : stripe(p) ? 3 : 0)
  const legs = [[0.8, 0.22, 0.18], [0.95, -0.22, -0.2], [-0.78, 0.2, -0.12], [-0.62, -0.2, 0.22]] // x, z, stride
  const tailP = (t) => [-1.05 - t * 0.7, 0.2 + Math.sin(t * 2.4) * 0.35 - t * 0.2, 0]
  return compose(n, 341, [
    [34, (i, c, r) => { const p = ell(r, [0, 0.12, 0], [1.08, 0.42, 0.38]); return O(jit(p, r, 0.006), shade(p)) }],
    [8, (i, c, r) => { const p = ell(r, [0.7, 0.16, 0], [0.42, 0.48, 0.4]); return O(jit(p, r, 0.006), shade(p, -0.12)) }],
    [12, (i, c, r) => { // head
      const p = ell(r, [1.42, 0.5, 0], [0.34, 0.32, 0.32])
      return O(jit(p, r, 0.005), p[0] > 1.62 || p[1] < 0.36 ? 2 : Math.sin(p[1] * 22) > 0.7 && p[0] < 1.55 ? 3 : 0)
    }],
    [4, (i, c, r) => { const p = ell(r, [1.74, 0.38, 0], [0.2, 0.15, 0.2]); return O(jit(p, r, 0.005), 2) }], // muzzle
    [1, (i, c, r) => O(jit([1.9, 0.42, 0], r, 0.02), 3)], // nose
    [2, (i, c, r) => { const side = r() < 0.5 ? -1 : 1, a = r() * Math.PI; return O(jit([1.34 + Math.cos(a) * 0.1, 0.78 + Math.sin(a) * 0.12, side * 0.2], r, 0.01), 0) }], // ears
    [1, (i, c, r) => O(jit([1.66, 0.58, (i % 2 ? 1 : -1) * 0.2], r, 0.012), 4)], // eyes
    [22, (i, c, r) => { // legs with paws, mid-stride
      const [lx, lz, st] = legs[i % 4], t = r()
      const top = [lx, -0.05, lz], bot = [lx + st, -1.02, lz]
      if (r() < 0.2) { const p = ell(r, [bot[0] + 0.06, -1.05, lz], [0.14, 0.06, 0.1]); return O(p, 2) }
      const p = tube(r, top, bot, 0.15, 0.09)
      return O(jit(p, r, 0.005), stripe(p) && t < 0.7 ? 3 : 0)
    }],
    [10, (i, c, r) => { // tail (animated): a = t along the tail
      const t = r(), c0 = tailP(t), a = r() * TAU, rr = 0.07 * (1 - t * 0.4)
      const p = [c0[0], c0[1] + Math.cos(a) * rr, Math.sin(a) * rr]
      return O(p, Math.sin(t * 22) > 0.4 || t > 0.9 ? 3 : 0, t, -1, 5)
    }],
    [6, (i, c, r) => { const p = ell(r, [0.05, -0.18, 0], [0.8, 0.14, 0.3]); return O(jit(p, r, 0.006), 2) }], // belly
  ])
}

/* 7 — Butterfly: Fay's butterfly curve for the wings, which flap in the shader */
export function butterfly(n) {
  const curve = (t) => {
    const k = Math.exp(Math.cos(t)) - 2 * Math.cos(4 * t) - Math.pow(Math.sin(t / 12), 5)
    return [Math.sin(t) * k, Math.cos(t) * k]
  }
  const S = 0.55
  return compose(n, 351, [
    [56, (i, c, r) => { // wing fill (rim darker, glowing eye-spots)
      const t = r() * TAU * 2, [x, y] = curve(t), f = Math.sqrt(r())
      const px = x * f * S, py = y * f * S + 0.2
      const d = Math.hypot(px - Math.sign(px) * 0.95, py - 0.55)
      const tint = f > 0.9 ? 3 : d < 0.16 ? 4 : f < 0.35 ? 1 : 0
      return O([px, py, (r() - 0.5) * 0.02], tint, -1, -1, 6)
    }],
    [16, (i, c, r) => { // wing outline and veins
      const t = r() * TAU * 2, [x, y] = curve(t)
      const f = r() < 0.6 ? 1 : r()
      return O([x * f * S, y * f * S + 0.2, 0], f === 1 ? 3 : 1, -1, -1, 6)
    }],
    [10, (i, c, r) => { const p = ell(r, [0, 0.1, 0], [0.07, 0.75, 0.07]); return O(jit(p, r, 0.004), 3) }], // body
    [3, (i, c, r) => { const p = ell(r, [0, 0.9, 0.02], [0.09, 0.09, 0.09]); return O(p, 3) }], // head
    [5, (i, c, r) => { // antennae with glowing tips
      const side = r() < 0.5 ? -1 : 1, t = r()
      const p = [side * t * 0.42, 0.95 + t * 0.62 - t * t * 0.1, 0.02]
      return O(t > 0.93 ? jit(p, r, 0.03) : jit(p, r, 0.006), t > 0.93 ? 4 : 3)
    }],
    [3, (i, c, r) => { const d = randomOnSphere(r), k = 1.6 + r() * 0.8; return O([d[0] * k, d[1] * k * 0.8, d[2] * k * 0.4], 4, r(), -1, 8) }], // pollen sparkles
  ])
}

export const HERO_SHAPES = [eagle, rocket, neural, robot, whale, tiger, butterfly]
export const HERO_NAMES = ['Golden eagle', 'Rocket', 'Neural sphere', 'Transformer', 'Blue whale', 'Tiger', 'Butterfly']
// [primary, secondary] colour per form; the primary one also tints the aura behind it
export const HERO_COLORS = [
  ['#f5b93a', '#ffd76a'], // golden eagle
  ['#ff7a2f', '#e8384f'], // rocket: flame orange, red trim
  ['#c8ff4d', '#8fb3ff'], // neural sphere: signature lime
  ['#ff3b3b', '#3d7bff'], // transformer: red and blue
  ['#3a8dff', '#9fd4ff'], // blue whale
  ['#ff8a1f', '#ffe2b8'], // tiger
  ['#b26bff', '#ff7ad9'], // butterfly: violet and pink
]
