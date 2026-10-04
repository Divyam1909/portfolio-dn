// The intro model cycles through seven forms. Each generator returns { pos, order } like shapes.js,
// with order = (tint, a, b, part):
//   tint  0 primary colour · 1 secondary colour · 2 neutral (silver/white) · 3 dark · 4 glowing accent · 5 black
//   (the sculpts in fauna.js, mammals.js, heart.js and brain.js add baked lighting as the fractional part of the tint)
//   part  animation group read by the shader (see heroAnim in scene.js); a/b are its parameters.
// All forms are built upright and untilted, roughly within a radius of 2.1.

import { compose, gauss, neuralSphere } from './shapes.js'
import { eagle, butterfly } from './fauna.js'
import { squirrel } from './mammals.js'
import { heart } from './heart.js'
import { brain } from './brain.js'

const TAU = Math.PI * 2
const lerp = (a, b, t) => a + (b - a) * t
const jit = (p, r, s) => [p[0] + gauss(r) * s, p[1] + gauss(r) * s, p[2] + gauss(r) * s]
const O = (p, tint, a = -1, b = -1, part = 0) => [p[0], p[1], p[2], tint, a, b, part]

/* Rocket, rolling slowly with a live exhaust plume */
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

/* The neural sphere (existing), with glowing synapse clusters */
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

// Slots (the shader's heroAnim/heroTint switch on these indices)
export const HERO_SHAPES = [eagle, rocket, neural, squirrel, heart, brain, butterfly]
export const HERO_NAMES = ['Golden eagle', 'Rocket', 'Neural sphere', 'Red squirrel', 'Heart', 'Brain', 'Butterfly']
// [primary, secondary] colour per form; the primary one also tints the aura behind it
export const HERO_COLORS = [
  ['#e8a93c', '#ffd35a'], // golden eagle: gold plumage, yellow beak and feet
  ['#ff7a2f', '#e8384f'], // rocket: flame orange, red trim
  ['#c8ff4d', '#8fb3ff'], // neural sphere: signature lime
  ['#c9612b', '#e8c49a'], // red squirrel: russet, cream hazelnut and hair tips
  ['#e3263f', '#4a78ff'], // heart: crimson muscle and arteries, blue veins
  ['#f08fa8', '#8fe3ff'], // brain: rosy cortex, cyan firing neurons
  ['#2d8cff', '#7fe3ff'], // butterfly: blue morpho with a cyan sheen
]
// the order they appear in: the eagle opens, the brain follows the heart
export const HERO_SEQUENCE = [0, 1, 3, 2, 6, 4, 5]
