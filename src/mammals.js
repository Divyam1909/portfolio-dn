// The red squirrel for the intro, plus the curve and fur helpers the other sculpts share.
//
// Built with the SDF toolkit in fauna.js and modelled on real anatomy (proportions, eye placement,
// ear shape and coat markings). The face gets extra sampling density, creases are darkened with
// ambient occlusion, and fur is a thin fuzz off the surface so the silhouette reads soft rather
// than plastic.
//
// Output matches hero.js: { pos, order }, order = (tint + shade, a, b, part). The tail uses part 5
// with a = position along the tail.

import { gauss } from './shapes.js'
import {
  TAU, clamp, lerp, sub, add, mul, dot, len, norm, cross, fbm,
  setView, shadeOf, T, makeSculpt, build,
} from './fauna.js'

/* ---------- helpers ---------- */

// open Catmull-Rom through 3D points: t in [0, 1] → point
export function curve(pts) {
  const n = pts.length - 1
  return (t) => {
    const f = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(f)), u = f - i
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)]
    const u2 = u * u, u3 = u2 * u
    return [0, 1, 2].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * u + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * u2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * u3))
  }
}
export const tangent = (c, t) => norm(sub(c(Math.min(1, t + 0.01)), c(Math.max(0, t - 0.01))))
export function frame(tn) {
  const ref = Math.abs(tn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const e1 = norm(cross(tn, ref))
  return [e1, cross(tn, e1)]
}

// fur: lift a surface point a little along its normal
const fuzz = (r, p, n, L) => add(p, mul(n, Math.abs(gauss(r)) * L))

// A pinna: a cupped shell from `base` to `tip`, hollow opening toward `face`.
// round 0 = pointed (fox) … 1 = rounded (cats). Returns the point, a normal and which side it's on.
export function ear(r, base, tip, face, W, o = {}) {
  const up = norm(sub(tip, base)), H = len(sub(tip, base))
  const side = norm(cross(up, face)), fwd = cross(side, up)
  const u = Math.pow(r(), o.bias ?? 0.85), v = r() * 2 - 1
  const round = o.round ?? 0
  const wid = W * lerp(1 - u, Math.sqrt(Math.max(0, 1 - u * u)) * (1 - u * 0.15), round)
  const back = r() < 0.5
  const cup = (o.cup ?? 0.45) * wid * (1 - v * v)
  const edge = Math.abs(v) > 0.86
  let p = add(add(base, mul(up, u * H)), mul(side, v * wid))
  p = add(p, mul(fwd, -cup - (back ? 0.014 : 0)))
  const n = back ? norm(add(mul(fwd, -1), mul(side, v * 0.4))) : norm(add(fwd, mul(side, -v * 0.5)))
  return { p, n, back, edge, u, v }
}

// An eye at `c` looking along `look`: dark lid rim, glowing iris, pupil (round or slit) and a
// catchlight. Returns the point and its tint.
export function eye(r, c, look, R, o = {}) {
  const upv = norm(sub([0, 1, 0], mul(look, dot([0, 1, 0], look)))), sidev = cross(look, upv)
  const almond = o.almond ?? 1.25, tilt = o.tilt ?? 0
  const a = r() * TAU, rim = r() < (o.rimShare ?? 0.3)
  const rad = rim ? R * (1 + Math.abs(gauss(r)) * 0.14) : R * Math.sqrt(r())
  let x = Math.cos(a) * rad * almond, y = Math.sin(a) * rad * (1 - 0.25 * Math.abs(Math.cos(a)))
  ;[x, y] = [x * Math.cos(tilt) - y * Math.sin(tilt), x * Math.sin(tilt) + y * Math.cos(tilt)]
  const bulge = rim ? 0 : Math.sqrt(Math.max(0, 1 - (rad / R) ** 2)) * R * 0.4
  const p = add(add(add(c, mul(sidev, x)), mul(upv, y)), mul(look, bulge))
  if (rim) return { p, tint: o.rimTint ?? 5, shade: o.rimShade ?? 0.35 }
  const px = Math.cos(a) * rad / R, py = Math.sin(a) * rad / R
  let tint = 4
  if (o.slit ? Math.abs(px) < 0.2 * (1 - py * py * 0.6) : Math.hypot(px, py) < (o.pupil ?? 0.42)) tint = 5
  if (Math.hypot(px + 0.32, py - 0.36) < 0.2) tint = 2 // catchlight
  return { p, tint, shade: tint === 5 ? 0.25 : 0.95 }
}

// volumetric bushy tail along a curve: dense at the surface, wispy outer hairs
function bushy(r, c, radius) {
  let t = 0
  for (let k = 0; k < 30; k++) { t = r(); if (r() < radius(t) / radius.max) break }
  const tn = tangent(c, t), [e1, e2] = frame(tn), a = r() * TAU
  const d = add(mul(e1, Math.cos(a)), mul(e2, Math.sin(a)))
  const R = radius(t), rho = R * (0.62 + 0.42 * Math.pow(r(), 0.45))
  const hair = r() < 0.25 ? r() * 0.06 : 0 // strands combed back along the tail
  const p = add(add(c(t), mul(d, rho)), mul(tn, -hair))
  return { p, n: d, t, outer: rho > R * 0.97 }
}

/* ============================================================================================
   RED SQUIRREL — Sciurus vulgaris, sitting up with a hazelnut. x = forward. Head-body ~20 cm,
   tail nearly as long and curled up over the back in an S. Russet coat, cream belly, big dark
   eyes ringed in pale fur, tufted ears, long hind feet flat on the ground.
   Head: part 22 (a, b = neck pivot). Paws and nut: part 23. Tail: part 5.
   ========================================================================================== */
export function squirrel(n) {
  setView(0.05, -0.55)
  const X = 0.12, Y = 0.02
  const prims = [
    { e: [[-0.12, -0.52, 0], [0.36, 0.32, 0.3]], tag: 'body' }, // seat
    { e: [[-0.02, -0.56, 0.18], [0.3, 0.21, 0.13]], tag: 'thigh' }, { e: [[-0.02, -0.56, -0.18], [0.3, 0.21, 0.13]], tag: 'thigh' },
    { e: [[0.0, -0.14, 0], [0.27, 0.38, 0.24]], tag: 'body' }, // torso
    { e: [[0.08, 0.16, 0], [0.21, 0.24, 0.2]], tag: 'body' }, // chest
    { e: [[0.18, 0.5, 0], [0.2, 0.19, 0.18]], tag: 'head', w: 2.6 },
    { e: [[0.36, 0.45, 0], [0.12, 0.1, 0.105]], tag: 'muzzle', k: 0.06, w: 3 },
    { e: [[0.26, 0.42, 0.1], [0.1, 0.085, 0.07]], tag: 'cheek', k: 0.05, w: 2.4 }, { e: [[0.26, 0.42, -0.1], [0.1, 0.085, 0.07]], tag: 'cheek', k: 0.05, w: 2.4 },
    { e: [[0.47, 0.47, 0], [0.028, 0.022, 0.03]], tag: 'nose', k: 0.02, w: 3 },
    // forelegs up to the mouth
    { c: [[0.12, 0.12, 0.15], [0.26, -0.02, 0.15], 0.07, 0.05], tag: 'arm', k: 0.04 }, { c: [[0.12, 0.12, -0.15], [0.26, -0.02, -0.15], 0.07, 0.05], tag: 'arm', k: 0.04 },
    { c: [[0.26, -0.02, 0.15], [0.4, 0.26, 0.06], 0.05, 0.035], tag: 'paw', k: 0.03 }, { c: [[0.26, -0.02, -0.15], [0.4, 0.26, -0.06], 0.05, 0.035], tag: 'paw', k: 0.03 },
    { e: [[0.42, 0.29, 0.05], [0.04, 0.045, 0.03]], tag: 'paw', k: 0.02, w: 1.5 }, { e: [[0.42, 0.29, -0.05], [0.04, 0.045, 0.03]], tag: 'paw', k: 0.02, w: 1.5 },
    // long hind feet
    { c: [[0.02, -0.8, 0.22], [0.44, -0.86, 0.25], 0.075, 0.04], tag: 'foot', k: 0.04 }, { c: [[0.02, -0.8, -0.22], [0.44, -0.86, -0.25], 0.075, 0.04], tag: 'foot', k: 0.04 },
  ]
  const body = makeSculpt(prims, 0.1)
  const tailC = curve([[-0.36, -0.7, 0], [-0.6, -0.58, 0], [-0.64, -0.2, 0], [-0.52, 0.2, 0], [-0.46, 0.6, 0], [-0.56, 0.94, 0], [-0.8, 1.1, 0], [-0.98, 0.98, 0], [-1.0, 0.82, 0]])
  const tailR = (t) => 0.07 + 0.21 * Math.pow(Math.sin(Math.PI * Math.min(0.97, 0.1 + t * 0.9)), 0.7)
  tailR.max = 0.29
  const earAt = (side) => ({ base: [0.12, 0.66, side * 0.1], tip: [0.08, 0.86, side * 0.15], face: norm([1, 0.1, side * 0.95]) })
  const eyeAt = (side) => { const c = body.project([0.33, 0.56, side * 0.12]); return { c: add(c, mul(body.grad(c), 0.004)), look: norm(add(body.grad(c), [0.25, 0.05, 0])) } }
  const eyes = [eyeAt(1), eyeAt(-1)]
  const HEAD = [0.1, 0.3] // neck pivot for nibbling
  const S = (p) => [p[0] - X, p[1] + Y, p[2]]
  const headPart = (tag) => tag === 'head' || tag === 'muzzle' || tag === 'cheek' || tag === 'nose'

  return build(n, 461, [
    [58, (r) => {
      const { p: p0, n: nn, tag, ao } = body.sample(r)
      const p = tag === 'nose' ? p0 : fuzz(r, p0, nn, tag === 'cheek' ? 0.02 : 0.012)
      const sh = shadeOf(nn) * lerp(0.3, 1, ao)
      const warp = fbm([p[0] * 8, p[1] * 8, p[2] * 8])
      let tint = 0
      if (tag === 'nose') tint = 5
      else if ((tag === 'body' || tag === 'muzzle' || tag === 'cheek') && nn[0] > 0.35 && nn[1] < 0.2 && p[1] < 0.46) tint = 2 // cream belly, throat, chin
      else if (tag === 'thigh' && nn[1] < -0.3) tint = 2
      if (tint === 0 && warp > 0.6) tint = 3
      const out = [...S(p), T(tint, sh * (0.85 + warp * 0.3))]
      if (headPart(tag)) return [...out, HEAD[0] - X, HEAD[1] + Y, 22]
      if (tag === 'paw' || tag === 'arm') return [...out, -1, -1, 23]
      return [...out, -1, -1, 0]
    }],
    [28, (r) => { // the tail: a big S-curved plume, russet with darker and silvery hair tips
      const b = bushy(r, tailC, tailR)
      const streak = fbm([b.p[0] * 10, b.p[1] * 10, b.p[2] * 10])
      const tint = b.outer && r() < 0.3 ? 1 : streak > 0.58 ? 3 : 0
      return [...S(b.p), T(tint, shadeOf(b.n) * (b.outer ? 0.8 : 1)), b.t, -1, 5]
    }],
    [4, (r) => { // ears with long tufts
      const side = r() < 0.5 ? -1 : 1, E = earAt(side)
      if (r() < 0.45) { // tuft: fine hairs rising from the tip
        const t = r(), a = r() * TAU, s = (1 - t) * 0.035
        const p = add(E.tip, [-0.02 * t + Math.cos(a) * s, t * 0.16, side * 0.02 * t + Math.sin(a) * s])
        return [...S(p), T(3, 0.7 - t * 0.3), HEAD[0] - X, HEAD[1] + Y, 22]
      }
      const e = ear(r, E.base, E.tip, E.face, 0.06, { round: 0.6, cup: 0.45 })
      return [...S(e.p), T(e.back ? 0 : 2, shadeOf(e.n) * (e.back ? 1 : 0.7)), HEAD[0] - X, HEAD[1] + Y, 22]
    }],
    [2.4, (r) => { // large dark eyes with a pale eye-ring
      const E = eyes[r() < 0.5 ? 0 : 1]
      const e = eye(r, E.c, E.look, 0.046, { almond: 1.1, pupil: 0.8, rimTint: 2, rimShade: 0.8, rimShare: 0.35 })
      return [...S(e.p), T(e.tint === 4 ? 3 : e.tint, e.shade), HEAD[0] - X, HEAD[1] + Y, 22]
    }],
    [2, (r) => { // hazelnut held to the mouth
      const d = norm([gauss(r), gauss(r), gauss(r)]), cap = d[0] < -0.2
      const p = add([0.47, 0.33, 0], [d[0] * 0.06, d[1] * 0.07, d[2] * 0.06])
      return [...S(p), T(cap ? 3 : 1, shadeOf(d)), -1, -1, 23]
    }],
    [0.6, (r) => { // whiskers
      const side = r() < 0.5 ? -1 : 1, k = Math.floor(r() * 4), t = r()
      const a = [0.44, 0.45, side * 0.05], dir = norm([-0.05 + k * 0.1, -0.1 + k * 0.06, side])
      return [...S(add(a, mul(dir, t * 0.2))), T(3, 0.6), HEAD[0] - X, HEAD[1] + Y, 22]
    }],
    [2.5, (r) => { const a = r() * TAU, rr = Math.sqrt(r()); return [...S([Math.cos(a) * 0.9 * rr, -0.9, Math.sin(a) * 0.55 * rr]), T(3, 0.06 + 0.16 * (1 - rr)), -1, -1, 0] }],
  ])
}
