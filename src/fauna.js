// The sculpting toolkit for the intro forms, and the blue morpho butterfly that opens them.
//
// Organic forms are sculpted as signed distance fields (smoothly blended ellipsoids and round
// cones, the same technique used for SDF character art), sampled on their surface and lit with a
// fixed key light baked into each particle. Wings and other thin parts are explicit geometry.
//
// Output matches hero.js: { pos, order } with order = (tint + shade, a, b, part), where the
// fractional part of the first value is baked lighting (0.02 … 0.98; an integer means unlit).

import { rng, gauss } from './shapes.js'

export const TAU = Math.PI * 2
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s]
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const len = (a) => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]) // (Math.hypot is slow)
export const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l] }
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]

/* ---------- value noise ---------- */
export function hash3(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
export function noise(p) {
  const xi = Math.floor(p[0]), yi = Math.floor(p[1]), zi = Math.floor(p[2])
  const xf = p[0] - xi, yf = p[1] - yi, zf = p[2] - zi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf)
  const c = (a, b, d) => hash3(xi + a, yi + b, zi + d)
  return lerp(lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v), w)
}
export const fbm = (p) => noise(p) * 0.5 + noise(mul(p, 2.03)) * 0.3 + noise(mul(p, 4.1)) * 0.2

/* ---------- lighting ----------
   Light is baked in the view the animal is shown in (its rest pose in the shader), so the key
   light, the shadows and the bright silhouette rim line up with what the camera actually sees. */
const KEY = norm([-0.45, 0.75, 0.6])
const FILL = norm([0.6, -0.2, 0.4])
let VIEW = (v) => v
// rest-pose rotation, same order as the shader: rotZ(rotY(rotX(p, x), y), z)
export function setView(x = 0, y = 0, z = 0) {
  VIEW = (v) => {
    let [a, b, c] = v, cs = Math.cos(x), sn = Math.sin(x)
    ;[b, c] = [b * cs - c * sn, b * sn + c * cs]
    cs = Math.cos(y); sn = Math.sin(y)
    ;[a, c] = [a * cs + c * sn, -a * sn + c * cs]
    cs = Math.cos(z); sn = Math.sin(z)
    ;[a, b] = [a * cs - b * sn, a * sn + b * cs]
    return [a, b, c]
  }
}
export function shadeOf(n, extra = 0) {
  n = VIEW(n)
  const d = Math.max(0, dot(n, KEY)), f = Math.max(0, dot(n, FILL)) * 0.25
  const rim = Math.pow(1 - Math.abs(n[2]), 3) * 0.3 // silhouettes catch light
  return clamp(0.1 + d * 0.74 + f + rim + extra, 0.02, 0.98)
}
export const T = (tint, shade) => tint + clamp(shade, 0.02, 0.98)

/* ---------- SDF primitives (after Inigo Quilez) ---------- */
export function sdEllipsoid(p, c, r) {
  const q = [(p[0] - c[0]) / r[0], (p[1] - c[1]) / r[1], (p[2] - c[2]) / r[2]]
  const k0 = len(q), k1 = len([q[0] / r[0], q[1] / r[1], q[2] / r[2]])
  return k1 > 1e-6 ? (k0 * (k0 - 1)) / k1 : -Math.min(r[0], r[1], r[2])
}
export function sdRoundCone(p, a, b, r1, r2) {
  const ba = sub(b, a), l2 = dot(ba, ba), rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2
  const pa = sub(p, a), y = dot(pa, ba), z = y - l2
  const xv = sub(mul(pa, l2), mul(ba, y)), x2 = dot(xv, xv)
  const y2 = y * y * l2, z2 = z * z * l2
  const k = Math.sign(rr) * rr * rr * x2
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1
}
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25 }

// A sculpt is a list of primitives { e: [c, r] } or { c: [a, b, r1, r2] }, each with an optional tag.
export function makeSculpt(prims, k = 0.08) {
  // bounding spheres: a primitive further away than the current distance plus its blend radius
  // can't change the blended result, so it is skipped (the big speed-up for detailed sculpts)
  const bounds = prims.map((q) => {
    if (q.e) return [...q.e[0], Math.max(...q.e[1]), q.k ?? k]
    const [a, b, r1, r2] = q.c
    return [...mix3(a, b, 0.5), len(sub(b, a)) / 2 + Math.max(r1, r2), q.k ?? k]
  })
  const distIn = (list) => (p) => {
    let d = 1e9
    for (let li = 0; li < list.length; li++) {
      const i = list[li], B = bounds[i], x = p[0] - B[0], y = p[1] - B[1], z = p[2] - B[2], m = d + B[4] + B[3]
      if (d < 1e8 && x * x + y * y + z * z > m * m) continue
      const q = prims[i]
      d = smin(d, q.e ? sdEllipsoid(p, q.e[0], q.e[1]) : sdRoundCone(p, q.c[0], q.c[1], q.c[2], q.c[3]), B[4])
    }
    return d
  }
  const gradOf = (f) => (p) => {
    const h = 0.002
    return norm([f([p[0] + h, p[1], p[2]]) - f([p[0] - h, p[1], p[2]]),
      f([p[0], p[1] + h, p[2]]) - f([p[0], p[1] - h, p[2]]),
      f([p[0], p[1], p[2] + h]) - f([p[0], p[1], p[2] - h])])
  }
  const dist = distIn(prims.map((_, i) => i)), grad = gradOf(dist)
  // near a given primitive only its neighbours can shape the surface: sample against those alone
  const local = bounds.map((A) => {
    const list = []
    bounds.forEach((B, j) => { if (len(sub(A, B)) < A[3] + B[3] + 0.4) list.push(j) })
    const f = distIn(list)
    return { dist: f, grad: gradOf(f) }
  })
  // surface areas for choosing which primitive to seed a sample from
  const areas = prims.map((q) => {
    if (q.e) { const [a, b, c] = q.e[1]; return 4 * Math.PI * Math.pow((Math.pow(a * b, 1.6) + Math.pow(a * c, 1.6) + Math.pow(b * c, 1.6)) / 3, 1 / 1.6) }
    const [a, b, r1, r2] = q.c; return Math.PI * (r1 + r2) * len(sub(b, a)) + 2 * Math.PI * (r1 * r1 + r2 * r2)
  }).map((a, i) => a * (prims[i].w ?? 1)) // w: extra sampling density (faces, paws)
  const total = areas.reduce((s, v) => s + v, 0)
  const seed = (r) => {
    let x = r() * total, i = 0
    while (x > areas[i] && i < areas.length - 1) x -= areas[i++]
    const q = prims[i]
    const u = r() * 2 - 1, t = r() * TAU, s = Math.sqrt(1 - u * u), d = [s * Math.cos(t), u, s * Math.sin(t)]
    if (q.e) return { p: add(q.e[0], [d[0] * q.e[1][0], d[1] * q.e[1][1], d[2] * q.e[1][2]]), i }
    const [a, b, r1, r2] = q.c, f = r()
    const axis = norm(sub(b, a)), ref = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
    const e1 = norm(cross(axis, ref)), e2 = cross(axis, e1), ang = r() * TAU, rad = lerp(r1, r2, f)
    return { p: add(mix3(a, b, f), add(mul(e1, Math.cos(ang) * rad), mul(e2, Math.sin(ang) * rad))), i }
  }
  // ambient occlusion: how open the space just outside the surface is (creases, armpits, eye sockets)
  const occlOf = (f) => (p, n) => clamp((f(add(p, mul(n, 0.07))) / 0.07) * 0.6 + (f(add(p, mul(n, 0.16))) / 0.16) * 0.4, 0, 1)
  const occl = occlOf(dist)
  const project = (p) => { for (let it = 0; it < 4; it++) p = sub(p, mul(grad(p), dist(p))); return p }
  // a point on the blended surface, its normal, the primitive it grew from and its occlusion
  const sample = (r) => {
    for (let tries = 0; tries < 20; tries++) {
      let { p, i } = seed(r)
      const L = local[i]
      if (L.dist(p) < -0.025) continue // buried inside another part
      for (let it = 0; it < 3; it++) { const d = L.dist(p); p = sub(p, mul(L.grad(p), d)) }
      if (Math.abs(L.dist(p)) < 0.01) { const n = L.grad(p); return { p, n, i, tag: prims[i].tag, ao: occlOf(L.dist)(p, n) } }
    }
    const { p, i } = seed(r)
    return { p, n: [0, 1, 0], i, tag: prims[i].tag, ao: 1 }
  }
  return { dist, grad, sample, project, occl }
}

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

// fill `n` particles from weighted part generators; each returns [x, y, z, o0, o1, o2, o3]
export function build(n, seed, parts) {
  const r = rng(seed)
  const pos = new Float32Array(n * 3), order = new Float32Array(n * 4).fill(-1)
  const total = parts.reduce((a, p) => a + p[0], 0)
  let i = 0
  parts.forEach(([w, fn], k) => {
    const count = k === parts.length - 1 ? n - i : Math.round((w / total) * n)
    for (let c = 0; c < count && i < n; c++, i++) {
      const v = fn(r, c)
      pos[i * 3] = v[0]; pos[i * 3 + 1] = v[1]; pos[i * 3 + 2] = v[2]
      order[i * 4] = v[3]; order[i * 4 + 1] = v[4]; order[i * 4 + 2] = v[5]; order[i * 4 + 3] = v[6]
    }
  })
  for (let a = n - 1; a > 0; a--) { // shuffle so any prefix is an even sample (quality tiers)
    const b = Math.floor(r() * (a + 1))
    for (let k = 0; k < 3; k++) { const t = pos[a * 3 + k]; pos[a * 3 + k] = pos[b * 3 + k]; pos[b * 3 + k] = t }
    for (let k = 0; k < 4; k++) { const t = order[a * 4 + k]; order[a * 4 + k] = order[b * 4 + k]; order[b * 4 + k] = t }
  }
  return { pos, order }
}

/* ============================================================================================
   BUTTERFLY — Blue morpho (Morpho peleides), wings open. x = span, y = along the body.
   Iridescent blue with black borders, a row of white spots and dark veins. Wings: part 6.
   ========================================================================================== */
export function spline(pts, samples = 18) { // closed Catmull-Rom
  const out = []
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[(i - 1 + pts.length) % pts.length], p1 = pts[i], p2 = pts[(i + 1) % pts.length], p3 = pts[(i + 2) % pts.length]
    for (let k = 0; k < samples; k++) {
      const t = k / samples, t2 = t * t, t3 = t2 * t
      out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)))
    }
  }
  return out
}
export function inside(poly, x, y) {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}
function edgeDist(poly, x, y, from = 0, to = 1) { // distance to part of the outline
  let d = 9
  const a = Math.floor(from * poly.length), b = Math.floor(to * poly.length)
  for (let i = a; i < b; i++) d = Math.min(d, Math.hypot(poly[i][0] - x, poly[i][1] - y))
  return d
}
export function butterfly(n) {
  setView(-0.4, 0, 0)
  const S = 0.95
  const FW = spline([[0.06, 0.08], [0.35, 0.6], [0.75, 0.98], [1.15, 1.22], [1.48, 1.3], [1.66, 1.16], [1.62, 0.9], [1.5, 0.55], [1.36, 0.25], [1.18, 0.02], [0.7, -0.02], [0.2, 0.0]])
  const HW = spline([[0.06, -0.02], [0.55, 0.02], [0.98, -0.05], [1.26, -0.24], [1.36, -0.52], [1.28, -0.8], [1.08, -1.06], [0.78, -1.2], [0.46, -1.18], [0.22, -0.98], [0.1, -0.62], [0.04, -0.28]])
  // outer margins (for the black border), as fractions of each outline
  const wings = [
    { poly: FW, margin: [0.18, 0.84], veins: 9, root: [0.08, 0.05] },
    { poly: HW, margin: [0.2, 0.84], veins: 7, root: [0.08, -0.04] },
  ]
  const spotsFW = [[1.45, 1.12], [1.5, 0.88], [1.42, 0.62], [1.3, 0.38], [1.18, 1.15]]
  const spotsHW = [[1.2, -0.3], [1.2, -0.62], [1.05, -0.9], [0.78, -1.06], [0.5, -1.06]]
  const wingPt = (r, w) => {
    const { poly } = wings[w]
    for (let t = 0; t < 60; t++) {
      const x = r() * 1.7, y = w ? -1.25 + r() * 1.3 : -0.05 + r() * 1.4
      if (inside(poly, x, y)) return [x, y]
    }
    return [0.3, w ? -0.3 : 0.3]
  }
  const colourAt = (w, x, y) => {
    const { poly, margin } = wings[w]
    const dm = edgeDist(poly, x, y, margin[0], margin[1])
    const costa = w === 0 ? edgeDist(poly, x, y, 0, 0.3) : 9
    const spots = w === 0 ? spotsFW : spotsHW
    if (spots.some(([sx, sy]) => Math.hypot(x - sx, y - sy) < 0.045)) return 2
    if (dm < 0.2 + (w === 0 ? 0.08 : 0) || costa < 0.1) return 5
    return 0
  }
  return build(n, 431, [
    [62, (r) => { // wing membrane
      const w = r() < 0.56 ? 0 : 1, [x, y] = wingPt(r, w), side = r() < 0.5 ? -1 : 1
      const irid = 0.55 + 0.45 * Math.sin(x * 2.5 + y * 3.5) * Math.sin(y * 1.7) // shifting sheen
      const tint = colourAt(w, x, y)
      return [side * x * S, y * S, (r() - 0.5) * 0.01, T(tint === 0 && irid > 0.9 && w === 0 ? 1 : tint, 0.35 + irid * 0.6), -1, -1, 6]
    }],
    [12, (r) => { // outlines
      const w = r() < 0.55 ? 0 : 1, poly = wings[w].poly, q = poly[Math.floor(r() * poly.length)], side = r() < 0.5 ? -1 : 1
      return [side * q[0] * S, q[1] * S, 0, T(5, 0.6), -1, -1, 6]
    }],
    [10, (r) => { // veins radiating from the wing base
      const w = r() < 0.55 ? 0 : 1, { poly, root, veins } = wings[w], k = Math.floor(r() * veins), side = r() < 0.5 ? -1 : 1
      const target = poly[Math.floor(lerp(0.12, 0.88, k / (veins - 1)) * poly.length)]
      const t = r(), x = lerp(root[0], target[0], t), y = lerp(root[1], target[1], t) + Math.sin(t * Math.PI) * 0.04
      if (!inside(poly, x, y)) return [side * root[0] * S, root[1] * S, 0, T(5, 0.3), -1, -1, 6]
      return [side * x * S, y * S, 0.004, T(5, 0.45), -1, -1, 6]
    }],
    [7, (r) => { // body: thorax, abdomen, head
      const q = r()
      let p, nn
      if (q < 0.4) { const a = r() * TAU, t = r(); p = [Math.cos(a) * 0.08 * Math.sin(Math.PI * t), 0.25 - t * 0.35, Math.sin(a) * 0.08 * Math.sin(Math.PI * t)]; nn = [Math.cos(a), 0, Math.sin(a)] }
      else if (q < 0.85) { const a = r() * TAU, t = r(); const rr = 0.055 * (1 - t * 0.6); p = [Math.cos(a) * rr, -0.1 - t * 0.85, Math.sin(a) * rr]; nn = [Math.cos(a), 0, Math.sin(a)] }
      else { const a = r() * TAU, b = Math.acos(r() * 2 - 1); nn = [Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)]; p = add([0, 0.34, 0.01], mul(nn, 0.07)) }
      return [...p, T(3, shadeOf(nn) * 0.8), -1, -1, 0]
    }],
    [3, (r) => { // clubbed antennae
      const side = r() < 0.5 ? -1 : 1, t = r()
      const p = [side * t * 0.34, 0.4 + t * 0.62 - t * t * 0.12, 0.02]
      return t > 0.9 ? [p[0] + gauss(r) * 0.018, p[1] + gauss(r) * 0.018, p[2], T(3, 0.8), -1, -1, 0] : [...p, T(3, 0.55), -1, -1, 0]
    }],
    [2, (r) => { const d = [gauss(r), gauss(r), gauss(r)], k = 1.7 + r() * 0.6, q = norm(d); return [q[0] * k, q[1] * k * 0.8, q[2] * k * 0.4, T(4, 0.9), r(), -1, 8] }], // sparkles
  ])
}
