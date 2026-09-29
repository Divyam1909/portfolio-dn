// Mammals for the intro: tiger, red fox, cheetah and red squirrel.
//
// Built with the SDF toolkit in fauna.js and modelled on real anatomy (proportions from field
// guides: shoulder height vs body length, digitigrade legs with the elbow at chest level and the
// hock high behind, eye placement, ear shape and coat markings). Faces get extra sampling density,
// creases are darkened with ambient occlusion, and fur is a thin fuzz off the surface so the
// silhouettes read soft rather than plastic.
//
// Output matches hero.js: { pos, order }, order = (tint + shade, a, b, part). Legs use part
// 12 + leg with (a, b) = the shoulder/hip pivot; tails use part 5 with a = position along the tail.

import { gauss } from './shapes.js'
import {
  TAU, clamp, lerp, sstep, sub, add, mul, dot, len, norm, cross, mix3, fbm, hash3,
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

// distance to the nearest jittered feature point of a 3D grid (solid spots, rosettes, mottling)
export function spotDist(p, cell, seed = 0) {
  const g = p.map((v) => v / cell), gi = g.map(Math.floor)
  let best = 9
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
    const x = gi[0] + a, y = gi[1] + b, z = gi[2] + c
    const f = [x + 0.15 + hash3(x, y, z + seed) * 0.7, y + 0.15 + hash3(y + seed, z, x) * 0.7, z + 0.15 + hash3(z, x + seed, y) * 0.7]
    best = Math.min(best, len(sub(f, g)))
  }
  return best * cell
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

// a digitigrade leg: shoulder/hip → elbow/stifle → wrist/hock → paw, as round cones
function legPrims(j, rad, z, tag, pawR) {
  const P = j.map(([x, y]) => [x, y, z])
  const out = []
  for (let k = 0; k < 3; k++) out.push({ c: [P[k], P[k + 1], rad[k], rad[k + 1]], tag, k: 0.05 })
  out.push({ e: [add(P[3], [pawR[0] * 0.45, -pawR[1] * 0.3, 0]), pawR], tag, k: 0.04, w: 1.4 })
  return out
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
   TIGER — Panthera tigris, mid-stride. x = forward (head +x), y = up, z = side.
   Shoulder height ≈ 0.55 × head-body length; massive forequarters, round pupils, white ear spots.
   ========================================================================================== */
export function tiger(n) {
  setView(0.12, -0.45)
  const X = 0.18 // shift so the whole animal is centred
  const legs = [ // shoulder/hip, elbow/stifle, wrist/hock, paw; z; rear?
    [[[0.62, 0.1], [0.64, -0.36], [0.7, -0.8], [0.76, -0.9]], 0.19, 0],
    [[[0.58, 0.1], [0.5, -0.38], [0.46, -0.8], [0.52, -0.9]], -0.19, 0],
    [[[-0.72, 0.16], [-0.5, -0.24], [-0.8, -0.58], [-0.76, -0.9]], 0.18, 1],
    [[[-0.68, 0.16], [-0.6, -0.26], [-0.92, -0.54], [-0.86, -0.9]], -0.18, 1],
  ]
  const prims = [
    { e: [[0.52, 0.16, 0], [0.5, 0.43, 0.31]], tag: 'body' }, // chest & shoulders
    { c: [[0.45, 0.14, 0], [-0.55, 0.14, 0], 0.37, 0.33], tag: 'body' }, // barrel
    { e: [[-0.66, 0.2, 0], [0.38, 0.38, 0.3]], tag: 'body' }, // hips
    { e: [[0.45, 0.48, 0.1], [0.2, 0.1, 0.1]], tag: 'body' }, { e: [[0.45, 0.48, -0.1], [0.2, 0.1, 0.1]], tag: 'body' }, // scapulae
    { e: [[0.05, -0.12, 0], [0.55, 0.14, 0.26]], tag: 'belly' },
    { c: [[0.8, 0.3, 0], [1.08, 0.44, 0], 0.27, 0.22], tag: 'neck' },
    { e: [[1.2, 0.5, 0], [0.26, 0.23, 0.23]], tag: 'head', w: 2.2 }, // skull
    { e: [[1.27, 0.6, 0], [0.16, 0.06, 0.15]], tag: 'head', k: 0.06, w: 2.2 }, // brow
    { e: [[1.16, 0.37, 0.14], [0.17, 0.15, 0.1]], tag: 'ruff', w: 1.6 }, { e: [[1.16, 0.37, -0.14], [0.17, 0.15, 0.1]], tag: 'ruff', w: 1.6 },
    { e: [[1.43, 0.41, 0], [0.13, 0.1, 0.13]], tag: 'muzzle', k: 0.06, w: 2.5 },
    { e: [[1.44, 0.4, 0.06], [0.09, 0.08, 0.07]], tag: 'muzzle', k: 0.04, w: 2.5 }, { e: [[1.44, 0.4, -0.06], [0.09, 0.08, 0.07]], tag: 'muzzle', k: 0.04, w: 2.5 }, // whisker pads
    { e: [[1.53, 0.44, 0], [0.04, 0.035, 0.05]], tag: 'nose', k: 0.03, w: 3 },
    { e: [[1.36, 0.29, 0], [0.12, 0.05, 0.09]], tag: 'jaw', k: 0.05, w: 2 },
  ]
  legs.forEach(([j, z, rear], li) => prims.push(...legPrims(j, rear ? [0.2, 0.12, 0.085, 0.075] : [0.17, 0.11, 0.085, 0.075], z, 'leg' + li, [0.13, 0.065, 0.1])))
  const tailC = curve([[-0.95, 0.28, 0], [-1.3, 0.1, 0], [-1.6, -0.2, 0], [-1.82, -0.36, 0], [-1.98, -0.26, 0]])
  for (let k = 0; k < 8; k++) prims.push({ c: [tailC(k / 8), tailC((k + 1) / 8), 0.085 - k * 0.005, 0.08 - k * 0.005], tag: 'tail', k: 0.03 })
  const body = makeSculpt(prims, 0.12)
  const tailT = (p) => { let best = 0, bd = 9; for (let k = 0; k <= 60; k++) { const d = len(sub(tailC(k / 60), p)); if (d < bd) { bd = d; best = k / 60 } } return best }
  const earSide = (side) => ({ base: [1.08, 0.66, side * 0.15], tip: [1.04, 0.8, side * 0.21], face: norm([1, 0.1, side * 0.35]) })
  const eyeAt = (side) => { const c = body.project([1.36, 0.53, side * 0.12]); return { c: add(c, mul(body.grad(c), 0.004)), look: norm(add(body.grad(c), [0.9, 0, 0])) } }
  const eyes = [eyeAt(1), eyeAt(-1)]

  return build(n, 411, [
    [90, (r) => {
      const { p: p0, n: nn, tag, ao } = body.sample(r)
      const p = tag === 'nose' ? p0 : fuzz(r, p0, nn, tag === 'ruff' ? 0.03 : 0.01)
      const sh = shadeOf(nn) * lerp(0.35, 1, ao)
      const q = [p[0] - X, p[1], p[2]]
      const warp = fbm([p[0] * 1.6, p[1] * 1.6, p[2] * 1.6])
      let tint = 0
      if (tag === 'nose') return [...q, T(p[1] > 0.45 ? 1 : 5, sh), -1, -1, 0]
      if (tag === 'tail') {
        const t = tailT(p)
        tint = t > 0.9 || Math.sin(t * 30 + warp * 2) > 0.45 ? 5 : nn[1] < -0.3 ? 2 : 0
        return [...q, T(tint, sh), t, -1, 5]
      }
      const leg = tag.startsWith('leg') ? +tag[3] : -1
      // white: belly, chest, inner legs, muzzle, cheeks, the spots above the eyes
      const belly = (tag === 'belly' || tag === 'body') && nn[1] < -0.35
      const chest = tag !== 'head' && p[0] > 0.75 && nn[1] < 0.1 && tag !== 'ruff'
      const inner = leg >= 0 && Math.sign(nn[2]) !== Math.sign(legs[leg][1])
      const brow = tag === 'head' && p[0] > 1.3 && p[1] > 0.57 && Math.abs(Math.abs(p[2]) - 0.1) < 0.045
      const face = tag === 'muzzle' || tag === 'jaw' || (tag === 'ruff' && nn[1] < 0.2) || brow
      if (belly || chest || inner || face) tint = 2
      // black stripes: vertical on body and neck, rings on legs, arcs on the forehead and cheeks
      let stripe = false
      if (tag === 'body' || tag === 'neck' || tag === 'belly') {
        const v = Math.sin((p[0] * 7.2 + warp * 2.2 + Math.abs(p[2]) * 1.2) * Math.PI)
        stripe = v > 0.62 - (nn[1] > 0.5 ? 0.15 : 0) && nn[1] > -0.55 && !(p[0] > 0.9 && nn[1] < 0)
      } else if (leg >= 0) {
        stripe = Math.sin((p[1] * 9 + warp * 2) * Math.PI) > 0.75 && p[1] > -0.7 && !inner
      } else if (tag === 'head') {
        stripe = !brow && Math.sin(Math.atan2(p[1] - 0.48, p[0] - 1.15) * 5 + warp * 3) > 0.82 && p[0] < 1.32
      } else if (tag === 'ruff') {
        stripe = Math.sin(p[0] * 14 + warp * 3) > 0.8
      } else if (tag === 'muzzle') {
        stripe = nn[1] > 0.2 && nn[0] > 0.5 && Math.abs(p[2]) < 0.03 && p[0] > 1.49 // dark bridge above the nose
      }
      if (stripe) tint = 5
      const out = [...q, T(tint, sh * (0.85 + warp * 0.3))]
      if (leg >= 0) { const [[[ax, ay]]] = legs[leg]; return [...out, ax - X, ay, 12 + leg] }
      return [...out, -1, -1, 0]
    }],
    [4, (r) => { // ears: rounded, black backs with the white "eye spot", pale fur inside
      const side = r() < 0.5 ? -1 : 1, E = earSide(side)
      const e = ear(r, E.base, E.tip, E.face, 0.085, { round: 1, cup: 0.5 })
      const spot = e.back && e.u > 0.3 && e.u < 0.7 && Math.abs(e.v) < 0.45
      const tint = e.back ? (spot ? 2 : 5) : e.edge ? 5 : 2
      return [e.p[0] - X, e.p[1], e.p[2], T(tint, shadeOf(e.n) * (e.back ? 1 : 0.6)), -1, -1, 0]
    }],
    [0.8, (r) => { // eyes: yellow-amber irises, round pupils
      const E = eyes[r() < 0.5 ? 0 : 1], e = eye(r, E.c, E.look, 0.034, { almond: 1.3, tilt: 0.25, pupil: 0.38 })
      return [e.p[0] - X, e.p[1], e.p[2], T(e.tint, e.shade), -1, -1, 0]
    }],
    [1.2, (r) => { // whiskers from the muzzle pads
      const side = r() < 0.5 ? -1 : 1, k = Math.floor(r() * 7), t = r()
      const a = [1.47 - X, 0.39 - (k % 3) * 0.015, side * 0.1], dir = norm([-0.15 + (k % 4) * 0.12, -0.12 - k * 0.04, side])
      const p = add(a, add(mul(dir, t * 0.36), [0, -t * t * 0.05, 0]))
      return [...p, T(2, 0.6 + (1 - t) * 0.3), -1, -1, 0]
    }],
    [3, (r) => { // a faint pool of dust under the paws
      const a = r() * TAU, rr = Math.sqrt(r())
      return [Math.cos(a) * 1.5 * rr - 0.1, -0.98, Math.sin(a) * 0.45 * rr, T(3, 0.08 + 0.18 * (1 - rr)), -1, -1, 0]
    }],
  ])
}

/* ============================================================================================
   RED FOX — Vulpes vulpes, standing alert. x = forward. Head-body ~70 cm, shoulder ~40 cm,
   tail ~70 % of the body, bushy with a white tip. Slender legs with black "stockings", big
   pointed ears with black backs, long narrow muzzle, white chin, throat and chest, slit pupils.
   ========================================================================================== */
export function fox(n) {
  setView(0.1, -0.5)
  const X = -0.18, Y = 0.04
  const legs = [
    [[[0.5, 0.02], [0.44, -0.3], [0.48, -0.74], [0.53, -0.86]], 0.11, 0],
    [[[0.48, 0.02], [0.52, -0.3], [0.62, -0.72], [0.68, -0.86]], -0.11, 0],
    [[[-0.5, 0.06], [-0.32, -0.28], [-0.62, -0.6], [-0.58, -0.86]], 0.12, 1],
    [[[-0.48, 0.06], [-0.4, -0.3], [-0.72, -0.58], [-0.68, -0.86]], -0.12, 1],
  ]
  const prims = [
    { e: [[0.46, -0.01, 0], [0.32, 0.26, 0.19]], tag: 'body' }, // chest
    { c: [[0.4, 0.0, 0], [-0.38, 0.04, 0], 0.23, 0.18], tag: 'body' }, // barrel, tucking toward the loins
    { e: [[-0.47, 0.05, 0], [0.25, 0.23, 0.18]], tag: 'body' }, // hips
    { e: [[0.44, 0.13, 0.09], [0.17, 0.1, 0.07]], tag: 'body' }, { e: [[0.44, 0.13, -0.09], [0.17, 0.1, 0.07]], tag: 'body' },
    { e: [[0.68, 0.02, 0], [0.18, 0.22, 0.16]], tag: 'ruff', w: 1.3 }, // fluffy throat & chest
    { c: [[0.6, 0.1, 0], [0.9, 0.36, 0], 0.16, 0.11], tag: 'neck' },
    { e: [[0.98, 0.44, 0], [0.15, 0.125, 0.125]], tag: 'head', w: 2.6 }, // skull
    { e: [[0.97, 0.38, 0.08], [0.1, 0.075, 0.065]], tag: 'cheek', k: 0.05, w: 2.4 }, { e: [[0.97, 0.38, -0.08], [0.1, 0.075, 0.065]], tag: 'cheek', k: 0.05, w: 2.4 },
    { c: [[1.06, 0.42, 0], [1.32, 0.37, 0], 0.075, 0.034], tag: 'muzzle', k: 0.05, w: 3 },
    { e: [[1.335, 0.372, 0], [0.028, 0.024, 0.028]], tag: 'nose', k: 0.02, w: 3 },
    { c: [[1.02, 0.35, 0], [1.26, 0.335, 0], 0.055, 0.022], tag: 'jaw', k: 0.04, w: 2.4 },
  ]
  legs.forEach(([j, z, rear], li) => prims.push(...legPrims(j, rear ? [0.14, 0.065, 0.04, 0.032] : [0.095, 0.052, 0.036, 0.03], z, 'leg' + li, [0.065, 0.032, 0.045])))
  const body = makeSculpt(prims, 0.1)
  const tailC = curve([[-0.62, 0.08, 0], [-0.92, -0.06, 0.02], [-1.2, -0.24, 0.05], [-1.45, -0.36, 0.04], [-1.68, -0.36, 0]])
  const tailR = (t) => 0.05 + 0.17 * Math.pow(Math.sin(Math.PI * Math.min(0.97, Math.pow(t, 0.75))), 0.75)
  tailR.max = 0.22
  const earAt = (side) => ({ base: [0.93, 0.53, side * 0.075], tip: [0.88, 0.84, side * 0.15], face: norm([1, 0.05, side * 0.95]) })
  const eyeAt = (side) => { const c = body.project([1.1, 0.47, side * 0.07]); return { c: add(c, mul(body.grad(c), 0.003)), look: norm(add(body.grad(c), [0.6, 0, 0])) } }
  const eyes = [eyeAt(1), eyeAt(-1)]
  const S = (p) => [p[0] - X, p[1] + Y, p[2]]

  return build(n, 441, [
    [74, (r) => {
      const { p: p0, n: nn, tag, ao } = body.sample(r)
      const p = tag === 'nose' ? p0 : fuzz(r, p0, nn, tag === 'ruff' ? 0.04 : tag === 'cheek' ? 0.025 : 0.012)
      const sh = shadeOf(nn) * lerp(0.3, 1, ao)
      const warp = fbm([p[0] * 6, p[1] * 6, p[2] * 6])
      const leg = tag.startsWith('leg') ? +tag[3] : -1
      let tint = 0
      if (tag === 'nose') tint = 5
      else if (tag === 'jaw' || tag === 'ruff') tint = 2
      else if (tag === 'cheek') tint = nn[1] < 0.35 ? 2 : 0
      else if (tag === 'muzzle') tint = nn[1] < 0.05 ? 2 : p[0] > 1.25 && nn[1] > 0.3 ? 3 : 0
      else if (leg >= 0) tint = p[1] < (legs[leg][2] ? -0.5 : -0.26) ? 3 : Math.sign(nn[2]) !== Math.sign(legs[leg][1]) ? 2 : 0
      else if ((tag === 'body' || tag === 'neck') && nn[1] < -0.55) tint = 2 // pale belly
      else if (tag === 'neck' && nn[1] < 0 && p[0] > 0.65) tint = 2
      // a darker, grizzled saddle along the back
      if (tint === 0 && nn[1] > 0.6 && (tag === 'body' || tag === 'neck') && warp > 0.52) tint = 3
      const out = [...S(p), T(tint, sh * (0.85 + warp * 0.3))]
      if (leg >= 0) { const [[[ax, ay]]] = legs[leg]; return [...out, ax - X, ay + Y, 12 + leg] }
      return [...out, -1, -1, 0]
    }],
    [16, (r) => { // the brush: bushy, darker overhairs, white tip
      const b = bushy(r, tailC, tailR)
      const streak = fbm([b.p[0] * 9, b.p[1] * 9, b.p[2] * 9])
      const tint = b.t > 0.87 ? 2 : streak > 0.6 ? 3 : b.n[1] < -0.5 ? 2 : 0
      return [...S(b.p), T(tint, shadeOf(b.n) * (b.outer ? 0.75 : 1)), b.t, -1, 5]
    }],
    [4, (r) => { // tall pointed ears: black backs, white fur lining the rims
      const side = r() < 0.5 ? -1 : 1, E = earAt(side)
      const e = ear(r, E.base, E.tip, E.face, 0.09, { round: 0.15, cup: 0.5 })
      const tint = e.back ? (e.u < 0.2 ? 0 : 3) : e.edge || (e.u < 0.6 && Math.abs(e.v) < 0.5) ? 2 : 3
      const p = e.back ? e.p : fuzz(r, e.p, e.n, 0.01)
      return [...S(p), T(tint, shadeOf(e.n) * (e.back ? 1 : 0.75)), -1, -1, 0]
    }],
    [0.7, (r) => { // amber eyes with vertical slit pupils, slanted
      const E = eyes[r() < 0.5 ? 0 : 1], e = eye(r, E.c, E.look, 0.024, { slit: true, almond: 1.45, tilt: 0.35 })
      return [...S(e.p), T(e.tint, e.shade), -1, -1, 0]
    }],
    [0.8, (r) => { // whiskers
      const side = r() < 0.5 ? -1 : 1, k = Math.floor(r() * 5), t = r()
      const a = [1.24, 0.36, side * 0.04], dir = norm([-0.1 + k * 0.08, -0.15 + k * 0.05, side])
      return [...S(add(a, mul(dir, t * 0.24))), T(2, 0.5 + (1 - t) * 0.4), -1, -1, 0]
    }],
    [2.5, (r) => { const a = r() * TAU, rr = Math.sqrt(r()); return [...S([Math.cos(a) * 1.6 * rr - 0.3, -0.9, Math.sin(a) * 0.4 * rr]), T(3, 0.06 + 0.16 * (1 - rr)), -1, -1, 0] }],
  ])
}

/* ============================================================================================
   CHEETAH — Acinonyx jubatus, sprinting. x = forward. Built for speed: small round head, deep
   narrow chest, wasp waist, very long slender legs, long tail held out as a rudder. Solid round
   black spots (not rosettes), black "tear marks" from the eyes to the mouth, white belly, a ringed
   tail with a white tip.
   Upper legs: part 12 + leg (a, b = shoulder/hip). Lower legs: part 16 + leg (a, b = elbow/stifle).
   Dust kicked up: part 21.
   ========================================================================================== */
export const CHEETAH_LEGS = [ // shoulder/hip, elbow/stifle, wrist/hock, paw; z; rear?
  [[[0.58, 0.14], [0.52, -0.3], [0.58, -0.84], [0.64, -0.98]], 0.12, 0],
  [[[0.56, 0.14], [0.5, -0.3], [0.56, -0.84], [0.62, -0.98]], -0.12, 0],
  [[[-0.64, 0.18], [-0.44, -0.26], [-0.76, -0.68], [-0.7, -0.98]], 0.13, 1],
  [[[-0.62, 0.18], [-0.42, -0.26], [-0.74, -0.68], [-0.68, -0.98]], -0.13, 1],
]
export const CHEETAH_X = -0.08
export function cheetah(n) {
  setView(0.08, -0.32)
  const X = CHEETAH_X, legs = CHEETAH_LEGS
  const prims = [
    { e: [[0.46, -0.04, 0], [0.36, 0.4, 0.21]], tag: 'body' }, // deep, narrow chest
    { c: [[0.35, 0.04, 0], [-0.42, 0.15, 0], 0.26, 0.12], tag: 'body' }, // wasp waist
    { e: [[-0.6, 0.16, 0], [0.26, 0.22, 0.17]], tag: 'body' }, // hips
    { e: [[0.5, 0.26, 0.09], [0.2, 0.1, 0.07]], tag: 'body' }, { e: [[0.5, 0.26, -0.09], [0.2, 0.1, 0.07]], tag: 'body' }, // scapulae
    { c: [[0.7, 0.16, 0], [0.98, 0.3, 0], 0.15, 0.1], tag: 'neck' },
    { e: [[1.05, 0.32, 0], [0.13, 0.115, 0.115]], tag: 'head', w: 2.6 }, // small round skull
    { e: [[1.17, 0.27, 0], [0.08, 0.07, 0.085]], tag: 'muzzle', k: 0.05, w: 3 },
    { e: [[1.235, 0.285, 0], [0.024, 0.02, 0.03]], tag: 'nose', k: 0.02, w: 3 },
    { e: [[1.13, 0.2, 0], [0.08, 0.035, 0.06]], tag: 'jaw', k: 0.04, w: 2.4 },
  ]
  legs.forEach(([j, z, rear], li) => {
    const rad = rear ? [0.17, 0.075, 0.045, 0.036] : [0.12, 0.062, 0.04, 0.034]
    const P = j.map(([x, y]) => [x, y, z])
    prims.push({ c: [P[0], P[1], rad[0], rad[1]], tag: 'leg' + li, k: 0.05 })
    prims.push({ c: [P[1], P[2], rad[1], rad[2]], tag: 'low' + li, k: 0.04 })
    prims.push({ c: [P[2], P[3], rad[2], rad[3]], tag: 'low' + li, k: 0.03 })
    prims.push({ e: [add(P[3], [0.03, -0.012, 0]), [0.062, 0.03, 0.042]], tag: 'low' + li, k: 0.03, w: 1.4 })
  })
  const body = makeSculpt(prims, 0.1)
  const tailC = curve([[-0.8, 0.2, 0], [-1.15, 0.12, 0], [-1.5, -0.02, 0], [-1.8, -0.06, 0], [-2.0, 0.06, 0]])
  const earAt = (side) => ({ base: [1.0, 0.41, side * 0.085], tip: [0.98, 0.48, side * 0.11], face: norm([1, 0.2, side * 0.3]) })
  const eyeAt = (side) => { const c = body.project([1.14, 0.35, side * 0.065]); return { c: add(c, mul(body.grad(c), 0.003)), look: norm(add(body.grad(c), [1, 0, 0])) } }
  const eyes = [eyeAt(1), eyeAt(-1)]
  // tear marks: from the inner corner of each eye down the side of the muzzle to the lip
  const tear = (side) => [[1.155, 0.335, side * 0.045], [1.17, 0.28, side * 0.06], [1.19, 0.22, side * 0.06]]
  const nearTear = (p) => {
    const side = Math.sign(p[2]) || 1, pts = tear(side)
    let d = 9
    for (let k = 0; k < 2; k++) for (let s = 0; s <= 10; s++) d = Math.min(d, len(sub(mix3(pts[k], pts[k + 1], s / 10), p)))
    return d
  }
  const S = (p) => [p[0] - X, p[1], p[2]]

  return build(n, 451, [
    [80, (r) => {
      const { p: p0, n: nn, tag, ao } = body.sample(r)
      const p = tag === 'nose' ? p0 : fuzz(r, p0, nn, 0.007)
      const sh = shadeOf(nn) * lerp(0.3, 1, ao)
      const upper = tag.startsWith('leg'), lower = tag.startsWith('low'), li = upper || lower ? +tag[3] : -1
      let tint = 0
      if (tag === 'nose') tint = 5
      else if (tag === 'jaw') tint = 2
      else if (tag === 'muzzle') tint = nn[1] < 0.1 || Math.abs(p[2]) > 0.04 ? 2 : 0
      else if ((tag === 'body' || tag === 'neck') && nn[1] < -0.45) tint = 2 // white underparts
      else if (li >= 0 && Math.sign(nn[2]) !== Math.sign(legs[li][1])) tint = 2
      // solid black spots, smaller on the face and legs, sparse on the belly
      if (tint === 0 || (tint === 2 && tag !== 'jaw' && tag !== 'muzzle')) {
        const cell = tag === 'head' ? 0.045 : li >= 0 ? 0.06 : tag === 'neck' ? 0.07 : 0.09
        const d = spotDist(p, cell, 3)
        const fade = lower ? sstep(-0.9, -0.5, p[1]) : 1
        if (d < cell * 0.3 * fade && !(tint === 2 && d > cell * 0.2)) tint = 5
      }
      if ((tag === 'head' || tag === 'muzzle') && nearTear(p) < 0.013) tint = 5
      if (tag === 'head' && nn[1] < 0.3 && p[0] > 1.1 && Math.abs(p[2]) > 0.05 && nearTear(p) > 0.02 && p[1] > 0.3) tint = 2 // pale around the eyes
      const out = [...S(p), T(tint, sh)]
      if (upper) { const [[[ax, ay]]] = legs[li]; return [...out, ax - X, ay, 12 + li] }
      if (lower) { const [[, [kx, ky]]] = legs[li]; return [...out, kx - X, ky, 16 + li] }
      return [...out, -1, -1, 0]
    }],
    [10, (r) => { // tail: spotted, then black rings, white tip
      const t = r(), c = tailC(t), tn = tangent(tailC, t), [e1, e2] = frame(tn), a = r() * TAU
      const d = add(mul(e1, Math.cos(a)), mul(e2, Math.sin(a))), R = lerp(0.06, 0.045, t) * (1 + Math.abs(gauss(r)) * 0.12)
      const p = add(c, mul(d, R))
      let tint = d[1] < -0.4 ? 2 : 0
      if (t < 0.6 && spotDist(p, 0.07, 5) < 0.02) tint = 5
      if (t >= 0.6) tint = Math.sin((t - 0.6) * 50) > 0.2 ? 5 : 2
      if (t > 0.95) tint = 2
      return [...S(p), T(tint, shadeOf(d)), t, -1, 5]
    }],
    [2, (r) => { // small, rounded ears set low on the sides of the head
      const side = r() < 0.5 ? -1 : 1, E = earAt(side), e = ear(r, E.base, E.tip, E.face, 0.05, { round: 1, cup: 0.4 })
      return [...S(e.p), T(e.back ? (e.u > 0.4 ? 5 : 0) : 2, shadeOf(e.n)), -1, -1, 0]
    }],
    [0.6, (r) => { // amber eyes, round pupils, black-rimmed
      const E = eyes[r() < 0.5 ? 0 : 1], e = eye(r, E.c, E.look, 0.022, { almond: 1.3, tilt: 0.2, pupil: 0.4 })
      return [...S(e.p), T(e.tint, e.shade), -1, -1, 0]
    }],
    [0.6, (r) => { // whiskers
      const side = r() < 0.5 ? -1 : 1, k = Math.floor(r() * 5), t = r()
      const a = [1.2, 0.25, side * 0.05], dir = norm([-0.1 + k * 0.08, -0.1 - k * 0.04, side])
      return [...S(add(a, mul(dir, t * 0.2))), T(2, 0.5 + (1 - t) * 0.4), -1, -1, 0]
    }],
    [4, (r) => { // dust kicked up behind: animated in the shader (a = phase, b = lane)
      return [0, -1.0, (r() - 0.5) * 0.7, T(3, 0.3 + r() * 0.3), r(), r(), 21]
    }],
  ])
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
