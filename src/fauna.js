// Realistic particle sculptures of the intro animals.
//
// Bodies are sculpted as signed distance fields (smoothly blended ellipsoids and round cones, the
// same technique used for SDF character art), sampled on their surface and lit with a fixed key
// light baked into each particle. Wings, feathers and fins are built as explicit thin geometry.
//
// Output matches hero.js: { pos, order } with order = (tint + shade, a, b, part), where the
// fractional part of the first value is baked lighting (0.02 … 0.98; an integer means unlit).

import { rng, gauss } from './shapes.js'

const TAU = Math.PI * 2
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const lerp = (a, b, t) => a + (b - a) * t
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len = (a) => Math.hypot(a[0], a[1], a[2])
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l] }
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]

/* ---------- value noise ---------- */
function hash3(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
function noise(p) {
  const xi = Math.floor(p[0]), yi = Math.floor(p[1]), zi = Math.floor(p[2])
  const xf = p[0] - xi, yf = p[1] - yi, zf = p[2] - zi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf)
  const c = (a, b, d) => hash3(xi + a, yi + b, zi + d)
  return lerp(lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v), w)
}
const fbm = (p) => noise(p) * 0.5 + noise(mul(p, 2.03)) * 0.3 + noise(mul(p, 4.1)) * 0.2

/* ---------- lighting ---------- */
const KEY = norm([-0.45, 0.75, 0.6])
const FILL = norm([0.6, -0.2, 0.4])
function shadeOf(n, extra = 0) {
  const d = Math.max(0, dot(n, KEY)), f = Math.max(0, dot(n, FILL)) * 0.25
  const rim = Math.pow(1 - Math.abs(n[2]), 3) * 0.25 // silhouettes catch light
  return clamp(0.12 + d * 0.72 + f + rim + extra, 0.02, 0.98)
}
const T = (tint, shade) => tint + clamp(shade, 0.02, 0.98)

/* ---------- SDF primitives (after Inigo Quilez) ---------- */
function sdEllipsoid(p, c, r) {
  const q = [(p[0] - c[0]) / r[0], (p[1] - c[1]) / r[1], (p[2] - c[2]) / r[2]]
  const k0 = len(q), k1 = len([q[0] / r[0], q[1] / r[1], q[2] / r[2]])
  return k1 > 1e-6 ? (k0 * (k0 - 1)) / k1 : -Math.min(r[0], r[1], r[2])
}
function sdRoundCone(p, a, b, r1, r2) {
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
function makeSculpt(prims, k = 0.08) {
  const dist = (p) => {
    let d = 1e9
    for (const q of prims) d = smin(d, q.e ? sdEllipsoid(p, q.e[0], q.e[1]) : sdRoundCone(p, ...q.c), q.k ?? k)
    return d
  }
  const grad = (p) => {
    const h = 0.002
    return norm([dist([p[0] + h, p[1], p[2]]) - dist([p[0] - h, p[1], p[2]]),
      dist([p[0], p[1] + h, p[2]]) - dist([p[0], p[1] - h, p[2]]),
      dist([p[0], p[1], p[2] + h]) - dist([p[0], p[1], p[2] - h])])
  }
  // surface areas for choosing which primitive to seed a sample from
  const areas = prims.map((q) => {
    if (q.e) { const [a, b, c] = q.e[1]; return 4 * Math.PI * Math.pow((Math.pow(a * b, 1.6) + Math.pow(a * c, 1.6) + Math.pow(b * c, 1.6)) / 3, 1 / 1.6) }
    const [a, b, r1, r2] = q.c; return Math.PI * (r1 + r2) * len(sub(b, a)) + 2 * Math.PI * (r1 * r1 + r2 * r2)
  })
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
  // a point on the blended surface, its normal, and the primitive it grew from
  const sample = (r) => {
    for (let tries = 0; tries < 20; tries++) {
      let { p, i } = seed(r)
      if (dist(p) < -0.025) continue // buried inside another part
      for (let it = 0; it < 3; it++) { const d = dist(p); p = sub(p, mul(grad(p), d)) }
      if (Math.abs(dist(p)) < 0.01) return { p, n: grad(p), i, tag: prims[i].tag }
    }
    const { p, i } = seed(r)
    return { p, n: [0, 1, 0], i, tag: prims[i].tag }
  }
  return { dist, sample }
}

// fill `n` particles from weighted part generators; each returns [x, y, z, o0, o1, o2, o3]
function build(n, seed, parts) {
  const r = rng(seed)
  const pos = new Float32Array(n * 3), order = new Float32Array(n * 4).fill(-1)
  const total = parts.reduce((a, p) => a + p[0], 0)
  let i = 0
  parts.forEach(([w, fn], k) => {
    const count = k === parts.length - 1 ? n - i : Math.round((w / total) * n)
    for (let c = 0; c < count && i < n; c++, i++) {
      const v = fn(r, c)
      pos.set(v.slice(0, 3), i * 3)
      order.set(v.slice(3, 7), i * 4)
    }
  })
  for (let a = n - 1; a > 0; a--) { // shuffle so any prefix is an even sample (quality tiers)
    const b = Math.floor(r() * (a + 1))
    for (let k = 0; k < 3; k++) { const t = pos[a * 3 + k]; pos[a * 3 + k] = pos[b * 3 + k]; pos[b * 3 + k] = t }
    for (let k = 0; k < 4; k++) { const t = order[a * 4 + k]; order[a * 4 + k] = order[b * 4 + k]; order[b * 4 + k] = t }
  }
  return { pos, order }
}

/* A feather: base, direction and up vector, length, half-width, curl. Returns a point on it
   (shaft or vane, with a crisp outline) and a normal for lighting. */
function feather(r, base, dir, up, L, W, o = {}) {
  const side = norm(cross(dir, up))
  const t = Math.pow(r(), o.tipBias ?? 0.85)
  const q = r()
  const prof = Math.pow(Math.sin(Math.PI * Math.min(1, 0.08 + t * 0.95)), 0.6) * (1 - t * (o.taper ?? 0.25))
  const asym = o.asym ?? 0 // outer vane narrower on flight feathers
  let u
  if (q < 0.14) u = gauss(r) * 0.08 // shaft
  else if (q < 0.4) u = r() < 0.5 ? -1 : 1 // outline
  else u = r() * 2 - 1
  const w = W * prof * (u > 0 ? 1 - asym : 1 + asym * 0.5)
  const curl = (o.curl ?? 0) * t * t * t + (o.camber ?? 0.02) * Math.sin(Math.PI * t) - Math.abs(u) * 0.012
  const p = add(add(add(base, mul(dir, t * L)), mul(side, u * w)), mul(up, curl))
  return { p, n: norm(add(up, mul(side, -u * 0.25))), t, edge: Math.abs(u) > 0.92 || q < 0.14 }
}

/* ============================================================================================
   GOLDEN EAGLE — Aquila chrysaetos, gliding. x = span, y = up, z = forward (head at +z).
   Wing particles: order = (tint+shade, span 0…1, side ±1, part 1). Tail: part 11.
   ========================================================================================== */
export function eagle(n) {
  const body = makeSculpt([
    { e: [[0, 0, -0.02], [0.23, 0.21, 0.5]] }, // torso
    { e: [[0, -0.05, 0.2], [0.21, 0.2, 0.3]] }, // breast
    { c: [[0, 0.04, 0.38], [0, 0.1, 0.6], 0.15, 0.115] }, // neck
    { e: [[0, 0.13, 0.7], [0.13, 0.125, 0.16]], tag: 'head' },
    { e: [[0, 0.17, 0.72], [0.1, 0.05, 0.1]], k: 0.05, tag: 'head' }, // brow
    { c: [[0, 0.12, 0.8], [0, 0.1, 0.93], 0.055, 0.035], k: 0.03, tag: 'beak' },
    { c: [[0, 0.1, 0.93], [0, 0.035, 0.97], 0.035, 0.008], k: 0.02, tag: 'hook' },
    { c: [[0, 0.0, -0.42], [0, 0.03, -0.62], 0.14, 0.08] }, // tail base
    { c: [[0.08, -0.14, -0.1], [0.07, -0.2, -0.42], 0.06, 0.04], tag: 'leg' }, // feathered legs, tucked
    { c: [[-0.08, -0.14, -0.1], [-0.07, -0.2, -0.42], 0.06, 0.04], tag: 'leg' },
    { c: [[0.07, -0.2, -0.42], [0.06, -0.24, -0.52], 0.035, 0.015], tag: 'talon' },
    { c: [[-0.07, -0.2, -0.42], [-0.06, -0.24, -0.52], 0.035, 0.015], tag: 'talon' },
  ], 0.1)

  // wing skeleton per side: shoulder → elbow → wrist → hand, gliding with a gentle dihedral
  const bone = (s) => {
    const pts = [[0.16, 0.06, 0.16], [0.62, 0.1, 0.22], [1.08, 0.16, 0.24], [1.5, 0.2, 0.1]]
    const f = clamp(s, 0, 1) * 3, k = Math.min(2, Math.floor(f))
    return mix3(pts[k], pts[k + 1], f - k)
  }
  const UP = [0, 1, 0]
  const mirror = (p, side) => [p[0] * side, p[1], p[2]]

  return build(n, 401, [
    [16, (r) => { // body plumage: dark brown, golden hackles on the nape and crown
      const { p, n: nn, tag } = body.sample(r)
      const sh = shadeOf(nn)
      if (tag === 'beak') return [...p, T(1, sh), -1, -1, 0]
      if (tag === 'hook' || tag === 'talon') return [...p, T(5, sh), -1, -1, 0]
      const nape = sstep(0.35, 0.65, p[2]) * sstep(0.0, 0.1, p[1]) // golden head & nape
      const streak = fbm([p[0] * 18, p[1] * 18, p[2] * 6]) // feather texture
      const tint = nape > 0.5 && streak > 0.35 ? 0 : streak > 0.62 ? 0 : 3
      return [...p, T(tint, sh * (0.8 + streak * 0.4)), -1, -1, 0]
    }],
    [1, (r, i) => { const side = i % 2 ? 1 : -1; return [side * 0.085, 0.16, 0.8, T(4, 0.9), -1, -1, 0] }], // eyes
    [14, (r) => { // secondaries: 14 per wing along the forearm, tips forming a serrated trailing edge
      const side = r() < 0.5 ? -1 : 1, k = Math.floor(r() * 14), s = 0.05 + (k / 13) * 0.62
      const b = bone(s), dir = norm([0.05 + s * 0.12, -0.02, -1])
      const f = feather(r, b, dir, UP, 0.78 - s * 0.1, 0.085, { asym: 0.1, camber: 0.03 })
      const p = mirror(f.p, side), nn = mirror(f.n, side)
      return [...p, T(3, shadeOf(nn, f.edge ? 0.22 : 0) * (1.1 - f.t * 0.45)), s * 0.72, side, 1]
    }],
    [16, (r) => { // primaries: ten per wing fanning from the hand; the outer seven splay into "fingers"
      const side = r() < 0.5 ? -1 : 1, k = Math.floor(r() * 10)
      const s = 0.7 + k * 0.03, b = bone(s)
      const ang = lerp(-1.15, 0.18, k / 9) // swept back → pointing out/forward
      const dir = norm([Math.cos(ang), 0.02 + k * 0.012, Math.sin(ang) - 0.25])
      const f = feather(r, b, dir, UP, 0.7 + Math.sin((k / 9) * Math.PI) * 0.32, k > 2 ? 0.055 : 0.075,
        { asym: 0.35, curl: k > 2 ? 0.16 : 0.05, taper: 0.45 })
      const p = mirror(f.p, side), nn = mirror(f.n, side)
      return [...p, T(3, shadeOf(nn, f.edge ? 0.28 : 0.05) * (1.1 - f.t * 0.35)), 0.72 + f.t * 0.28, side, 1]
    }],
    [14, (r) => { // coverts: three overlapping rows over the arm, lighter tawny tips
      const side = r() < 0.5 ? -1 : 1, row = Math.floor(r() * 3), s = r() * 0.95
      const b = add(bone(s), [0, 0.02 + row * 0.012, -0.02 - row * 0.13])
      const dir = norm([0.1, -0.03, -1])
      const f = feather(r, b, dir, UP, 0.32 - row * 0.05, 0.065, { camber: 0.015 })
      const p = mirror(f.p, side), nn = mirror(f.n, side)
      const tawny = f.t > 0.7 && fbm([p[0] * 9, 0, p[2] * 9]) > 0.45
      return [...p, T(tawny || row === 0 ? 0 : 3, shadeOf(nn, f.edge ? 0.2 : 0.05)), s * 0.8, side, 1]
    }],
    [5, (r) => { // leading edge (patagium): a smooth rounded edge
      const side = r() < 0.5 ? -1 : 1, s = r() * 0.95, b = bone(s), a = r() * TAU
      const p = mirror(add(b, [0, Math.cos(a) * 0.035, 0.02 + Math.sin(a) * 0.035]), side)
      return [...p, T(3, shadeOf(norm([0, Math.cos(a), Math.sin(a)]))), s * 0.8, side, 1]
    }],
    [8, (r) => { // tail: twelve rectrices fanned, with a paler band
      const k = Math.floor(r() * 12), ang = lerp(-0.42, 0.42, k / 11)
      const base = [Math.sin(ang) * 0.05, 0.02, -0.55]
      const f = feather(r, base, norm([Math.sin(ang), 0.02, -Math.cos(ang)]), UP, 0.62, 0.075, { camber: 0.02 })
      const band = f.t > 0.35 && f.t < 0.55
      return [...f.p, T(band ? 0 : 3, shadeOf(f.n, f.edge ? 0.2 : 0) * (f.t > 0.85 ? 0.6 : 1)), f.t, -1, 11]
    }],
  ])
}

/* ============================================================================================
   TIGER — Panthera tigris, mid-stride. x = forward (head +x), y = up, z = side.
   Legs: part 12 + index, a = pivot x, b = pivot y. Tail: part 5, a = t along the tail.
   ========================================================================================== */
export function tiger(n) {
  const X = 0.18 // shift so the whole animal is centred
  const legs = [ // [shoulder/hip, elbow/knee, wrist/hock, paw, z, isRear]
    [[0.62, 0.08], [0.66, -0.36], [0.72, -0.8], 0.19, 0],
    [[0.58, 0.08], [0.5, -0.38], [0.46, -0.8], -0.19, 0],
    [[-0.72, 0.14], [-0.5, -0.24], [-0.8, -0.56], 0.18, 1],
    [[-0.68, 0.14], [-0.6, -0.26], [-0.92, -0.52], -0.18, 1],
  ]
  const prims = [
    { e: [[0.52, 0.16, 0], [0.5, 0.43, 0.31]], tag: 'body' }, // chest & shoulders
    { c: [[0.45, 0.14, 0], [-0.55, 0.14, 0], 0.37, 0.33], tag: 'body' }, // barrel
    { e: [[-0.66, 0.2, 0], [0.38, 0.38, 0.3]], tag: 'body' }, // hips
    { e: [[0.45, 0.48, 0.1], [0.2, 0.1, 0.1]], tag: 'body' }, { e: [[0.45, 0.48, -0.1], [0.2, 0.1, 0.1]], tag: 'body' }, // scapulae
    { e: [[0.05, -0.12, 0], [0.55, 0.14, 0.26]], tag: 'belly' },
    { c: [[0.8, 0.3, 0], [1.08, 0.44, 0], 0.27, 0.22], tag: 'neck' },
    { e: [[1.2, 0.5, 0], [0.27, 0.24, 0.24]], tag: 'head' }, // skull
    { e: [[1.16, 0.37, 0.13], [0.17, 0.15, 0.1]], tag: 'ruff' }, { e: [[1.16, 0.37, -0.13], [0.17, 0.15, 0.1]], tag: 'ruff' },
    { e: [[1.43, 0.4, 0], [0.14, 0.11, 0.13]], tag: 'muzzle', k: 0.06 },
    { e: [[1.5, 0.43, 0], [0.045, 0.035, 0.05]], tag: 'nose', k: 0.03 },
    { e: [[1.36, 0.3, 0], [0.12, 0.05, 0.09]], tag: 'jaw', k: 0.05 },
    { e: [[1.1, 0.72, 0.16], [0.04, 0.09, 0.08]], tag: 'ear', k: 0.04 }, { e: [[1.1, 0.72, -0.16], [0.04, 0.09, 0.08]], tag: 'ear', k: 0.04 },
  ]
  legs.forEach(([a, b, c, z, rear], li) => {
    const A = [a[0], a[1], z], B = [b[0], b[1], z], C = [c[0], c[1], z]
    const paw = rear ? [c[0] + 0.08, -0.9, z] : [c[0] + 0.07, -0.92, z]
    prims.push({ c: [A, B, rear ? 0.2 : 0.17, rear ? 0.12 : 0.11], tag: 'leg' + li })
    prims.push({ c: [B, C, rear ? 0.1 : 0.1, 0.075], tag: 'leg' + li })
    if (rear) prims.push({ c: [C, [c[0] + 0.03, -0.88, z], 0.075, 0.07], tag: 'leg' + li })
    prims.push({ e: [paw, [0.13, 0.065, 0.1]], tag: 'leg' + li, k: 0.05 })
  })
  const tailPts = [[-0.95, 0.28], [-1.3, 0.1], [-1.6, -0.2], [-1.82, -0.36], [-1.98, -0.26]]
  for (let k = 0; k < 4; k++) prims.push({ c: [[...tailPts[k], 0], [...tailPts[k + 1], 0], 0.085 - k * 0.012, 0.075 - k * 0.012], tag: 'tail', k: 0.04 })
  const body = makeSculpt(prims, 0.12)
  const tailT = (p) => { // approximate position along the tail
    let best = 0, bd = 9
    for (let k = 0; k <= 40; k++) {
      const t = k / 40, f = t * 4, i = Math.min(3, Math.floor(f)), q = mix3([...tailPts[i], 0], [...tailPts[i + 1], 0], f - i)
      const d = len(sub(q, p)); if (d < bd) { bd = d; best = t }
    }
    return best
  }
  return build(n, 411, [
    [92, (r) => {
      const { p, n: nn, tag } = body.sample(r)
      const sh = shadeOf(nn)
      const q = [p[0] - X, p[1], p[2]]
      const warp = fbm([p[0] * 1.6, p[1] * 1.6, p[2] * 1.6])
      let tint = 0
      if (tag === 'nose') return [...q, T(5, sh), -1, -1, 0]
      if (tag === 'tail') {
        const t = tailT(p)
        tint = t > 0.9 || Math.sin(t * 30 + warp * 2) > 0.45 ? 5 : nn[1] < -0.3 ? 2 : 0
        return [...q, T(tint, sh), t, -1, 5]
      }
      const leg = tag.startsWith('leg') ? +tag[3] : -1
      // white: belly, chest, inner legs, muzzle, cheeks, eyebrow spots
      const belly = (tag === 'belly' || tag === 'body') && nn[1] < -0.35
      const chest = tag !== 'head' && p[0] > 0.75 && nn[1] < 0.1 && tag !== 'ruff'
      const inner = leg >= 0 && Math.sign(nn[2]) !== Math.sign(legs[leg][3])
      const face = (tag === 'muzzle' || tag === 'jaw') || (tag === 'ruff' && nn[1] < 0.2) || (tag === 'head' && p[0] > 1.28 && p[1] > 0.52 && Math.abs(p[2]) > 0.05 && Math.abs(p[2]) < 0.14)
      if (belly || chest || inner || face) tint = 2
      // black stripes: vertical on body and neck, rings on legs, around the eyes on the face
      let stripe = false
      if (tag === 'body' || tag === 'neck' || tag === 'belly') {
        const v = Math.sin((p[0] * 7.2 + warp * 2.2 + Math.abs(p[2]) * 1.2) * Math.PI)
        stripe = v > 0.62 - (nn[1] > 0.5 ? 0.15 : 0) && nn[1] > -0.55 && !(p[0] > 0.9 && nn[1] < 0)
      } else if (leg >= 0) {
        stripe = Math.sin((p[1] * 9 + warp * 2) * Math.PI) > 0.75 && p[1] > -0.7 && !inner
      } else if (tag === 'head') {
        stripe = Math.sin((Math.atan2(p[1] - 0.48, p[0] - 1.15) * 5 + warp * 3)) > 0.82 && p[0] < 1.3
      } else if (tag === 'ruff') {
        stripe = Math.sin((p[0] * 14 + warp * 3)) > 0.8
      } else if (tag === 'ear') {
        tint = nn[0] < 0 ? 5 : 0 // black backs of the ears
      }
      if (stripe) tint = 5
      const out = [...q, T(tint, sh * (0.85 + warp * 0.3))]
      if (leg >= 0) { const [[ax, ay]] = legs[leg]; return [...out, ax - X, ay, 12 + leg] }
      return [...out, -1, -1, 0]
    }],
    [2, (r, i) => { // eyes: amber, with a catchlight
      const side = i % 2 ? 1 : -1
      return [1.34 - X + gauss(r) * 0.008, 0.53 + gauss(r) * 0.008, side * 0.115, T(4, 0.95), -1, -1, 0]
    }],
    [1, (r) => { // whiskers
      const side = r() < 0.5 ? -1 : 1, k = Math.floor(r() * 5), t = r()
      const a = [1.47 - X, 0.38, side * 0.11], b = [1.47 - X - 0.02 + t * 0.06, 0.38 - k * 0.02 - t * 0.05, side * (0.11 + t * 0.32)]
      return [...mix3(a, b, t), T(2, 0.9), -1, -1, 0]
    }],
    [4, (r) => { // ground shadow-light: a faint pool of dust under the paws
      const a = r() * TAU, rr = Math.sqrt(r())
      return [Math.cos(a) * 1.5 * rr - 0.1, -0.98, Math.sin(a) * 0.45 * rr, T(3, 0.1 + 0.2 * (1 - rr)), -1, -1, 0]
    }],
  ])
}

/* ============================================================================================
   BLUE WHALE — Balaenoptera musculus. x = forward (snout +x). Long and slender, flat U-shaped
   head, splashguard, throat pleats, tiny dorsal fin far back, long pectorals, notched flukes.
   Body particles: part 3 with a = u (0 tail … 1 snout). Spout: part 9.
   ========================================================================================== */
export function whale(n) {
  const L = 4.2, X0 = -L / 2 + 0.05
  const R = (u) => { // body radius along the length
    const base = 0.4 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.pow(u, 0.72) * 0.92 + 0.05)), 0.9)
    return Math.max(0.05, base * (u < 0.12 ? 0.45 + u * 4.6 : 1))
  }
  const ry = (u) => R(u) * (1 - 0.38 * sstep(0.7, 1, u)) // head flattens
  const rz = (u) => R(u) * (1 + 0.28 * sstep(0.62, 0.95, u)) // …and broadens (U-shaped from above)
  const at = (u, a, k = 1) => [X0 + u * L, Math.sin(a) * ry(u) * k + (u > 0.8 ? (u - 0.8) * 0.12 : 0), Math.cos(a) * rz(u) * k]
  const nrm = (u, a) => norm([0.1 * (u > 0.85 ? 1 : u < 0.2 ? -1 : 0), Math.sin(a) / ry(u), Math.cos(a) / rz(u)])
  return build(n, 421, [
    [58, (r) => {
      const u = Math.pow(r(), 0.85), a = r() * TAU
      const p = at(u, a), nn = nrm(u, a)
      const mottle = fbm([p[0] * 3.2, p[1] * 5, p[2] * 5])
      const belly = Math.sin(a) < -0.45
      const tint = mottle > 0.66 ? 2 : belly ? 1 : 0
      return [...p, T(tint, shadeOf(nn) * (0.8 + mottle * 0.35)), u, -1, 3]
    }],
    [10, (r) => { // throat pleats: long grooves from chin to navel
      const g = Math.floor(r() * 22), a = -Math.PI / 2 + (g - 10.5) * 0.085, u = lerp(0.56, 0.985, r())
      const p = at(u, a, 1.008)
      return [...p, T(2, shadeOf(nrm(u, a), 0.1)), u, -1, 3]
    }],
    [3, (r) => { // mouth line, curving down to the jaw hinge
      const side = r() < 0.5 ? -1 : 1, t = r(), u = lerp(0.79, 0.995, t)
      const a = side > 0 ? -0.15 - (1 - t) * 0.35 : Math.PI + 0.15 + (1 - t) * 0.35
      return [...at(u, a, 1.01), T(5, 0.3), u, -1, 3]
    }],
    [2, (r) => { // splashguard ridge and blowholes
      const u = lerp(0.8, 0.86, r()), a = Math.PI / 2 + gauss(r) * 0.12
      return [...at(u, a, 1.05), T(2, 0.85), u, -1, 3]
    }],
    [1, (r, i) => { const side = i % 2 ? 1 : -1; return [...at(0.79, side > 0 ? 0.05 : Math.PI - 0.05, 1.01), T(5, 0.2), 0.79, -1, 3] }], // eyes
    [2, (r) => { // small falcate dorsal fin, far back
      const t = r(), f = r(), u = 0.25 - t * 0.05 - f * 0.05
      const p = at(u, Math.PI / 2)
      return [p[0] - t * 0.08, p[1] + t * 0.13 * (1 - f * 0.6), (r() - 0.5) * 0.02, T(0, shadeOf([0, 0.3, 1])), u, -1, 3]
    }],
    [8, (r) => { // long, slender pectoral fins with pale undersides
      const side = r() < 0.5 ? -1 : 1, t = r(), w = (r() * 2 - 1) * 0.07 * (1 - t * 0.7)
      const root = at(0.68, side > 0 ? -0.55 : Math.PI + 0.55, 0.95)
      const p = [root[0] - t * 0.62 + w, root[1] - t * 0.3, root[2] + side * t * 0.32]
      return [...p, T(t > 0.2 && r() < 0.5 ? 2 : 0, shadeOf(norm([0.3, -0.5, side]))), 0.68, -1, 3]
    }],
    [10, (r) => { // flukes: broad, swept, with a median notch
      const side = r() < 0.5 ? -1 : 1, t = Math.sqrt(r()), f = r()
      const z = side * t * 0.78
      const lead = X0 - 0.02 - t * t * 0.3, trail = X0 - 0.2 - t * 0.22 + t * t * 0.12 + (t < 0.08 ? 0.08 : 0)
      const x = lerp(lead, trail, f)
      const edge = f > 0.92 || f < 0.06
      return [x, 0.01 * Math.sin(t * 3), z, T(edge ? 2 : 0, shadeOf([0, 1, 0.3], edge ? 0.1 : 0)), 0.0, -1, 3]
    }],
    [6, (r) => { const top = at(0.84, Math.PI / 2); return [...top, T(2, 0.9), r(), r() * TAU, 9] }], // spout
  ])
}

/* ============================================================================================
   BUTTERFLY — Blue morpho (Morpho peleides), wings open. x = span, y = along the body.
   Iridescent blue with black borders, a row of white spots and dark veins. Wings: part 6.
   ========================================================================================== */
function spline(pts, samples = 18) { // closed Catmull-Rom
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
function inside(poly, x, y) {
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
