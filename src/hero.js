// The intro model cycles through seven forms. Each generator returns { pos, order } like shapes.js,
// with order = (tint, a, b, part):
//   tint  0 primary colour · 1 secondary colour · 2 neutral (silver/white) · 3 dark · 4 glowing accent · 5 black
//   (the animals in fauna.js add baked lighting as the fractional part of the tint)
//   part  animation group read by the shader (see heroAnim in scene.js); a/b are its parameters.
// All forms are built upright and untilted, roughly within a radius of 2.1.

import { compose, gauss, randomOnSphere, neuralSphere } from './shapes.js'
import { eagle, whale, butterfly } from './fauna.js'
import { tiger, fox, cheetah, squirrel } from './mammals.js'
import { heart } from './heart.js'

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

// Slots (the shader's heroAnim/heroTint switch on these indices)
export const HERO_SHAPES = [eagle, rocket, neural, robot, whale, tiger, butterfly, fox, cheetah, squirrel, heart]
export const HERO_NAMES = ['Golden eagle', 'Rocket', 'Neural sphere', 'Transformer', 'Blue whale', 'Tiger', 'Butterfly', 'Red fox', 'Cheetah', 'Red squirrel', 'Heart']
// [primary, secondary] colour per form; the primary one also tints the aura behind it
export const HERO_COLORS = [
  ['#e8a93c', '#ffd35a'], // golden eagle: gold plumage, yellow beak and feet
  ['#ff7a2f', '#e8384f'], // rocket: flame orange, red trim
  ['#c8ff4d', '#8fb3ff'], // neural sphere: signature lime
  ['#ff3b3b', '#3d7bff'], // transformer: red and blue
  ['#4b8fe8', '#a9c9ee'], // blue whale: blue-grey with a paler belly
  ['#f27a1c', '#ffd28a'], // tiger: orange coat, amber eyes
  ['#2d8cff', '#7fe3ff'], // butterfly: blue morpho with a cyan sheen
  ['#ec6a24', '#ffb347'], // red fox: russet coat, amber eyes
  ['#e2ab52', '#ffcf6b'], // cheetah: tawny gold, amber eyes
  ['#c9612b', '#e8c49a'], // red squirrel: russet, cream hazelnut and hair tips
  ['#e3263f', '#4a78ff'], // heart: crimson muscle and arteries, blue veins
]
// the order they appear in: the eagle opens, animals alternate with the other forms
export const HERO_SEQUENCE = [0, 1, 7, 2, 4, 8, 3, 10, 9, 5, 6]
