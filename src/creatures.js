// Intro forms: a jellyfish, a samurai under a cherry tree, and an eastern dragon. Output matches
// hero.js: { pos, order } with order = (tint + shade, a, b, part); motion lives in heroAnim.

import { rng, gauss, randomOnSphere } from './shapes.js'
import { TAU, clamp, lerp, sstep, sub, add, mul, dot, len, norm, cross, fbm, setView, shadeOf, T, makeSculpt, build, curve, tangent, frame } from './fauna.js'

const V = (p, tint, sh, a = -1, b = -1, part = 0) => [p[0], p[1], p[2], T(tint, sh), a, b, part]

/* ============================================================================================
   JELLYFISH — a moon-jelly-like medusa: a translucent bell with a scalloped margin, radial
   canals and four glowing gonads, frilled oral arms trailing below and thirty-two fine marginal
   tentacles. The bell pulses (the margin contracts most) and the tentacles follow in a wave.
   Bell: part 41 (a = 0 apex … 1 margin). Tentacles: part 42 (a = along, b = angle).
   Oral arms: part 43 (a = along, b = arm).
   ========================================================================================== */
export const JELLY = { top: 1.2, R: 1.0, RY: 0.72, TH: 1.72 }
export function jellyfish(n) {
  setView(0.3, 0, 0)
  const { top, R, RY, TH } = JELLY
  const bell = (v, ph, inner = 0) => { // v: 0 apex … 1 margin
    const th = v * TH, scallop = 1 + 0.035 * sstep(0.85, 1, v) * Math.cos(ph * 16)
    const rr = (R - inner) * Math.sin(th) * scallop, y = top - (RY - inner) * (1 - Math.cos(th))
    return [Math.cos(ph) * rr, y, Math.sin(ph) * rr]
  }
  const bellN = (v, ph) => norm([Math.cos(ph) * Math.sin(v * TH) / R, Math.cos(v * TH) / RY, Math.sin(ph) * Math.sin(v * TH) / R])
  const rimY = bell(1, 0)[1]
  return build(n, 571, [
    [34, (r) => { // the bell: brighter towards its silhouette, as translucent tissue is
      const v = Math.sqrt(r()), ph = r() * TAU, inner = r() < 0.3 ? 0.06 : 0
      const nn = bellN(v, ph), rim = Math.pow(1 - Math.abs(nn[2]), 2)
      return V(bell(v, ph, inner), inner ? 3 : 0, (0.15 + rim * 0.55 + sstep(0.9, 1, v) * 0.3) * (inner ? 0.7 : 1), v, ph, 41)
    }],
    [6, (r) => { const k = Math.floor(r() * 16), ph = (k / 16) * TAU + gauss(r) * 0.006, v = Math.sqrt(r()) * 0.97; return V(bell(v, ph, 0.01), 1, 0.5 + v * 0.3, v, ph, 41) }], // radial canals
    [5, (r) => { // four horseshoe gonads seen through the bell
      const k = Math.floor(r() * 4), a0 = (k / 4) * TAU + Math.PI / 4, t = r() * 4 - 2
      const ph = a0 + t * 0.32, v = 0.34 + 0.12 * Math.cos(t * 0.9) + gauss(r) * 0.015
      return V(bell(v, ph, 0.1), 4, 0.7 + r() * 0.25, v, ph, 41)
    }],
    [4, (r) => { const ph = r() * TAU; return V(bell(1, ph, (r() - 0.5) * 0.02), r() < 0.25 ? 4 : 1, 0.85, 1, ph, 41) }], // the margin
    [27, (r) => { // marginal tentacles, thinning to the tip
      const k = Math.floor(r() * 32), ph = (k / 32) * TAU + 0.05, t = Math.pow(r(), 0.8), L = 2.2 + 0.4 * Math.sin(k * 2.3)
      const b = bell(0.995, ph), p = add(b, [Math.cos(ph) * t * 0.1, -t * L, Math.sin(ph) * t * 0.1])
      return V(add(p, mul(randomOnSphere(r), 0.008 * (1 - t))), 0, 0.55 - t * 0.35, t, ph, 42)
    }],
    [18, (r) => { // four frilled oral arms: ribbons that ruffle along their edges
      const k = Math.floor(r() * 4), ph0 = (k / 4) * TAU, t = r(), w = r() * 2 - 1
      const L = 1.75, sp = 0.1 + t * 0.32, spine = [Math.cos(ph0 + t * 0.7) * sp, rimY + 0.15 - t * L, Math.sin(ph0 + t * 0.7) * sp]
      const across = [Math.cos(ph0 + t * 0.7 + Math.PI / 2), 0, Math.sin(ph0 + t * 0.7 + Math.PI / 2)]
      const width = 0.11 * Math.sin(Math.PI * Math.min(1, 0.15 + t)) + 0.02
      const frill = Math.sin(t * 40 + w * 3) * 0.05 * Math.abs(w)
      const p = add(add(spine, mul(across, w * width)), [Math.cos(ph0) * frill, 0, Math.sin(ph0) * frill])
      return V(p, Math.abs(w) > 0.85 ? 4 : 1, 0.35 + Math.abs(w) * 0.4, t, k, 43)
    }],
  ])
}

/* ============================================================================================
   SAMURAI — a warrior in armour under a cherry tree in bloom. He stands in a guard stance with
   his katana raised before him in both hands: kabuto helmet with crescent horns and neck guard,
   a half mask, lacquered lamellar cuirass, great shoulder guards, plated skirt over wide
   hakama, his scabbard at the hip. The tree leans over him, blossoms stirring in the wind, and
   petals drift down to the ground. Blade: part 53 (a = along, for the glint). Blossom: part 54
   (a = sway). Falling petals: part 52 (a = phase, b = random).
   ========================================================================================== */
export const SAMURAI_VIEW = [0.06, -0.15]
export function samurai(n) {
  setView(...SAMURAI_VIEW)
  const GROUND = -1.72
  // --- the warrior, built facing +z, then turned and placed
  const YAW = 0.55, S = 1.2, ORIGIN = [0.5, GROUND, 0.35]
  const cy = Math.cos(YAW), sy = Math.sin(YAW)
  const turn = (q) => [q[0] * cy + q[2] * sy, q[1], -q[0] * sy + q[2] * cy]
  const place = (q) => add(ORIGIN, mul(turn(q), S))
  const G = norm([0.05, 0.62, 0.62]), H0 = [0.0, 0.9, 0.3] // sword axis and the pommel
  const onGrip = (t) => add(H0, mul(G, t))
  const tsuba = onGrip(0.25), handL = onGrip(0.05), handR = onGrip(0.18)
  const fig = makeSculpt([
    { e: [[0.12, 0.04, 0.36], [0.07, 0.045, 0.12]], tag: 'foot' }, { e: [[-0.16, 0.04, -0.22], [0.07, 0.045, 0.12]], tag: 'foot' },
    { c: [[0.11, 0.92, 0.02], [0.12, 0.12, 0.3], 0.15, 0.21], tag: 'hakama', k: 0.06 },
    { c: [[-0.11, 0.92, -0.02], [-0.16, 0.12, -0.26], 0.15, 0.21], tag: 'hakama', k: 0.06 },
    { c: [[0, 1.02, 0], [0, 0.64, 0], 0.25, 0.36], tag: 'skirt', k: 0.04 },
    { e: [[0, 1.03, 0], [0.25, 0.05, 0.2]], tag: 'belt', k: 0.03 },
    { e: [[0, 1.24, 0], [0.27, 0.25, 0.19]], tag: 'armor' },
    { e: [[0, 1.28, 0.06], [0.24, 0.18, 0.14]], tag: 'armor', k: 0.06 },
    { e: [[0.36, 1.3, 0], [0.08, 0.19, 0.17]], tag: 'sode', k: 0.04 }, { e: [[-0.36, 1.3, 0], [0.08, 0.19, 0.17]], tag: 'sode', k: 0.04 },
    { c: [[0, 1.44, 0], [0, 1.53, 0.01], 0.06, 0.055], tag: 'face' },
    { e: [[0, 1.62, 0.03], [0.095, 0.115, 0.105]], tag: 'face' },
    { e: [[0, 1.575, 0.085], [0.085, 0.055, 0.06]], tag: 'mask', k: 0.03 },
    { e: [[0, 1.69, 0], [0.145, 0.1, 0.15]], tag: 'helmet', k: 0.04 },
    { e: [[0, 1.655, 0.06], [0.17, 0.022, 0.16]], tag: 'helmet', k: 0.03 },
    { c: [[0, 1.66, -0.03], [0, 1.5, -0.07], 0.16, 0.24], tag: 'shikoro', k: 0.04 },
    { c: [[-0.3, 1.33, 0.02], [-0.22, 1.08, 0.22], 0.085, 0.068], tag: 'arm', k: 0.04 },
    { c: [[-0.22, 1.08, 0.22], handR, 0.062, 0.045], tag: 'kote', k: 0.03 },
    { c: [[0.3, 1.33, 0.02], [0.2, 1.02, 0.18], 0.085, 0.068], tag: 'arm', k: 0.04 },
    { c: [[0.2, 1.02, 0.18], handL, 0.062, 0.045], tag: 'kote', k: 0.03 },
    { e: [handR, [0.045, 0.045, 0.045]], tag: 'hand', k: 0.02 }, { e: [handL, [0.045, 0.045, 0.045]], tag: 'hand', k: 0.02 },
  ], 0.06)
  const up = norm(sub([0, 1, 0], mul(G, G[1]))), BL = 0.95 // the blade's spine side, and its length
  const blade = (t) => add(add(tsuba, mul(G, t * BL)), mul(up, 0.05 * t * t)) // with a gentle curve (sori)
  const horn = (s) => curve([[s * 0.03, 1.73, 0.14], [s * 0.13, 1.86, 0.15], [s * 0.2, 1.99, 0.1], [s * 0.19, 2.08, 0.03]])
  const horns = [horn(1), horn(-1)]

  // --- the cherry tree: a leaning trunk, boughs reaching over the warrior, clusters of blossom
  const TREE = [
    [[[-1.2, GROUND, -0.35], [-1.08, -1.1, -0.32], [-1.22, -0.5, -0.27], [-1.02, 0.1, -0.3], [-0.78, 0.55, -0.35]], 0.21, 0.11],
    [[[-1.06, 0.0, -0.3], [-0.45, 0.8, -0.25], [0.35, 1.12, -0.15], [1.15, 1.22, 0.05], [1.7, 1.02, 0.25]], 0.09, 0.025],
    [[[-0.78, 0.55, -0.35], [-0.45, 1.15, -0.4], [-0.05, 1.5, -0.3]], 0.085, 0.02],
    [[[-1.1, -0.2, -0.28], [-1.6, 0.6, -0.1], [-1.9, 0.95, 0.1]], 0.065, 0.02],
    [[[-0.78, 0.55, -0.35], [-0.95, 1.2, 0.15], [-1.25, 1.55, 0.3]], 0.06, 0.015],
    [[[0.4, 1.0, -0.2], [0.6, 1.4, -0.4], [0.95, 1.68, -0.3]], 0.04, 0.012],
    [[[-0.4, 0.75, -0.25], [-0.1, 1.05, 0.25], [0.15, 1.2, 0.5]], 0.04, 0.012],
  ].map(([pts, r0, r1]) => ({ c: curve(pts), r0, r1 }))
  const rr = rng(77)
  const blooms = []
  TREE.forEach((B, k) => {
    const count = k === 0 ? 4 : 12
    for (let i = 0; i < count; i++) {
      const t = k === 0 ? 0.85 + rr() * 0.15 : 0.3 + rr() * 0.7
      const c = add(B.c(t), [gauss(rr) * 0.14, 0.05 + Math.abs(gauss(rr)) * 0.12, gauss(rr) * 0.14])
      blooms.push({ c, R: 0.2 + rr() * 0.15 })
    }
  })
  const bloomW = blooms.map((b) => b.R * b.R), bloomT = bloomW.reduce((a, b) => a + b, 0)
  const pickBloom = (r) => { let x = r() * bloomT, k = 0; while (x > bloomW[k] && k < blooms.length - 1) x -= bloomW[k++]; return blooms[k] }
  const treeW = TREE.map((B) => (B.r0 + B.r1) * 2), treeT = treeW.reduce((a, b) => a + b, 0)

  return build(n, 601, [
    [30, (r) => { // the warrior
      const { p, n: nn, tag, ao } = fig.sample(r)
      const wn = turn(nn), sh = Math.min(0.98, (0.2 + shadeOf(wn) * 0.95) * lerp(0.45, 1, ao))
      let tint = 1, s = sh
      if (tag === 'hakama' || tag === 'foot') { tint = 2; s = sh * (0.55 + 0.3 * Math.sin(Math.atan2(p[2], p[0]) * 9) ** 2) } // pale hakama, pleated
      else if (tag === 'skirt' || tag === 'armor' || tag === 'shikoro') {
        const band = ((p[1] * (tag === 'shikoro' ? 34 : 22)) % 1 + 1) % 1
        if (band < 0.1) { tint = 5; s = sh } // lacing between the lames
        if (tag === 'skirt' && Math.abs(((Math.atan2(p[2], p[0]) * 7) / TAU) % 1) < 0.05) tint = 5 // the skirt's split panels
        if (tag === 'shikoro') tint = band < 0.1 ? 5 : 3
      } else if (tag === 'sode') { const band = ((p[1] * 18) % 1 + 1) % 1; tint = band < 0.18 ? 2 : 1; s = band < 0.18 ? sh * 0.8 : sh }
      else if (tag === 'belt') tint = 0
      else if (tag === 'helmet') { tint = 3; s = sh * 1.1 + (nn[1] > 0.7 ? 0.1 : 0) }
      else if (tag === 'face') tint = 2
      else if (tag === 'mask') tint = 1
      else if (tag === 'arm') { tint = 1; s = sh * 0.9 }
      else if (tag === 'kote' || tag === 'hand') { tint = 3; s = sh * 1.1 }
      return V(place(p), tint, s, -1, -1, 0)
    }],
    [6, (r) => { // the katana: a bright edge and a glint that runs along it, the habaki, guard and wrapped grip
      const q = r()
      if (q < 0.72) {
        const t = r(), w = 0.028 * (1 - 0.25 * t) * Math.min(1, (1 - t) / 0.08), v = r() * 2 - 1
        const p = add(blade(t), mul(up, v * w))
        const edge = v < -0.8
        return V(place(p), 2, edge ? 0.95 : 0.5 + 0.3 * Math.abs(v), t, -1, 53)
      }
      if (q < 0.82) { const a = r() * TAU, rad = Math.sqrt(r()) * 0.055, e1 = norm(cross(G, [1, 0, 0])), e2 = cross(G, e1); return V(place(add(tsuba, add(mul(e1, Math.cos(a) * rad), mul(e2, Math.sin(a) * rad)))), rad > 0.045 ? 2 : 1, 0.85, -1, -1, 0) } // tsuba
      const t = r(), a = r() * TAU, e1 = norm(cross(G, [1, 0, 0])), e2 = cross(G, e1)
      const p = add(onGrip(t * 0.25), add(mul(e1, Math.cos(a) * 0.02), mul(e2, Math.sin(a) * 0.02)))
      const diamond = Math.abs(((t * 9 + a / TAU * 2) % 1) - 0.5) < 0.12
      return V(place(p), diamond ? 2 : 3, diamond ? 0.75 : 0.5, -1, -1, 0)
    }],
    [2, (r) => { // the scabbard at the hip, and the helmet's crescent horns and crest
      const q = r()
      if (q < 0.45) { const a = [0.24, 1.0, 0.08], b = [0.42, 0.62, -0.62], t = r(), d = sub(b, a), e1 = norm(cross(d, [0, 1, 0])), e2 = norm(cross(d, e1)), ang = r() * TAU
        return V(place(add(add(a, mul(d, t)), add(mul(e1, Math.cos(ang) * 0.024), mul(e2, Math.sin(ang) * 0.024)))), t < 0.05 ? 1 : 3, 0.55 + 0.3 * Math.cos(ang), -1, -1, 0) }
      if (q < 0.9) { const c = horns[r() < 0.5 ? 0 : 1], t = r(), tn = tangent(c, t), side = norm(cross(tn, [0, 0, 1])), w = (r() * 2 - 1) * lerp(0.035, 0.008, t); return V(place(add(c(t), mul(side, w))), 2, 0.9, -1, -1, 0) }
      const a = r() * TAU, rad = Math.sqrt(r()) * 0.032; return V(place([Math.cos(a) * rad, 1.76 + Math.sin(a) * rad, 0.156]), 4, 0.9, -1, -1, 0)
    }],
    [16, (r) => { // trunk and boughs: dark bark, rough, with a flare at the roots
      let x = r() * treeT, k = 0
      while (x > treeW[k] && k < TREE.length - 1) x -= treeW[k++]
      const B = TREE[k], t = r(), c = B.c(t), [e1, e2] = frame(tangent(B.c, t)), a = r() * TAU
      const flare = k === 0 ? 1 + 0.7 * Math.pow(1 - sstep(0, 0.12, t), 2) : 1
      const nn = add(mul(e1, Math.cos(a)), mul(e2, Math.sin(a))), bark = fbm([c[0] * 9, c[1] * 3, a * 2])
      const rad = lerp(B.r0, B.r1, t) * flare * (0.92 + bark * 0.16)
      return V(add(c, mul(nn, rad)), 3, clamp((0.45 + shadeOf(nn) * 0.55) * (0.8 + bark * 0.4), 0.05, 0.98), -1, -1, 0)
    }],
    [30, (r) => { // blossom: puffy clusters, pink with paler tops and a few sparkling flowers
      const B = pickBloom(r), d = randomOnSphere(r), rad = B.R * (0.8 + 0.2 * r())
      const p = add(B.c, [d[0] * rad, d[1] * rad * 0.8, d[2] * rad])
      const top = d[1] > 0.35 && r() < 0.55, spark = r() < 0.06
      return V(p, spark ? 4 : top ? 2 : 0, Math.min(0.98, shadeOf(d) * 0.6 + 0.42), clamp((p[1] + 0.2) / 2, 0, 1), -1, 54)
    }],
    [10, (r) => { const B = pickBloom(r), d = randomOnSphere(r); return V(add(B.c, mul(d, B.R)), r() < 0.3 ? 2 : 0, 0.75, r(), r(), 52) }], // falling petals
    [6, (r) => { // fallen petals on the ground, thickest under the tree
      const a = r() * TAU, rad = Math.sqrt(r())
      return V([-0.35 + Math.cos(a) * rad * 2.0, GROUND + Math.abs(gauss(r)) * 0.008, Math.sin(a) * rad * 0.85], r() < 0.3 ? 2 : 0, 0.25 + (1 - rad) * 0.35, -1, -1, 0)
    }],
  ])
}

/* ============================================================================================
   DRAGON — an eastern lung dragon coiling through the air: a long serpent body with overlapping
   scales and a pale banded belly, gilt dorsal spines, four clawed legs, a flaming tail tuft and a
   long-snouted head with antler horns, a mane, glowing eyes, teeth and trailing barbels, breathing
   fire in bursts. Body, legs, spines, tail: part 46 (a = 0 neck … 1 tail tip). Head: part 47.
   Barbels: part 48 (a = along). Fire: part 49 (a = phase, b = 0 core … 1 outer flame).
   ========================================================================================== */
export const DRAGON_VIEW = [0.15, 0.1]
const DRAGON = (() => {
  const body = curve([[-1.25, 0.95, 0.55], [-0.55, 1.15, 0.15], [0.3, 0.75, -0.35], [0.95, 0.05, 0.1], [0.45, -0.6, 0.65], [-0.45, -0.75, 0.25], [-1.05, -0.3, -0.35], [-0.45, 0.15, -0.8], [0.55, -0.15, -0.65], [1.3, -0.75, -0.2], [1.85, -0.45, 0.35]].map(([x, y, z]) => [x + 0.4, y, z]))
  const L = 34 // samples for the arc-length table
  const pts = Array.from({ length: L + 1 }, (_, i) => body(i / L))
  const acc = [0]; for (let i = 1; i <= L; i++) acc.push(acc[i - 1] + len(sub(pts[i], pts[i - 1])))
  const total = acc[L]
  const at = (s) => { // arc-length parameter s in [0, 1] → curve parameter
    const d = s * total; let i = 1; while (i < L && acc[i] < d) i++
    return (i - 1 + (d - acc[i - 1]) / (acc[i] - acc[i - 1] || 1)) / L
  }
  const radius = (s) => 0.15 * (1 - Math.pow(s, 1.3) * 0.9) * lerp(0.8, 1, sstep(0, 0.06, s))
  // a frame that stays upright along the coil: up is world up made perpendicular to the tangent
  const frameAt = (s) => {
    const u = at(s), tn = tangent(body, u)
    const up = norm(sub([0, 1, 0], mul(tn, dot([0, 1, 0], tn)))), side = cross(tn, up)
    return { c: body(u), tn, up, side }
  }
  // the head lives in its own frame (x side, y up, z forward), placed at the neck
  const F0 = frameAt(0), fwd = mul(F0.tn, -1), hUp = F0.up, hSide = cross(hUp, fwd)
  const toWorld = (q) => add(add(add(F0.c, mul(fwd, q[2] + 0.12)), mul(hUp, q[1])), mul(hSide, q[0]))
  const toWorldN = (q) => norm(add(add(mul(fwd, q[2]), mul(hUp, q[1])), mul(hSide, q[0])))
  return { body, total, radius, frameAt, toWorld, toWorldN }
})()
// where the fire leaves the open jaws, the way it streams, and two axes across the jet
export const DRAGON_FIRE = (() => {
  const { toWorld, toWorldN } = DRAGON, dir = toWorldN([0, -0.16, 1]), e1 = norm(cross(dir, [0, 1, 0]))
  return { mouth: toWorld([0, -0.12, 0.52]), dir, e1, e2: cross(e1, dir) }
})()
export function dragon(n) {
  setView(...DRAGON_VIEW)
  const { total, radius, frameAt, toWorld, toWorldN } = DRAGON
  const head = makeSculpt([
    { e: [[0, 0.03, 0], [0.19, 0.16, 0.22]], tag: 'skull' },
    { c: [[0, 0.02, 0.12], [0, -0.01, 0.5], 0.14, 0.095], tag: 'snout' },
    { e: [[0, 0.01, 0.53], [0.11, 0.08, 0.07]], tag: 'snout', k: 0.05 },
    { e: [[0.06, 0.07, 0.55], [0.04, 0.03, 0.03]], tag: 'nostril', k: 0.03 }, { e: [[-0.06, 0.07, 0.55], [0.04, 0.03, 0.03]], tag: 'nostril', k: 0.03 },
    { e: [[0.11, 0.13, 0.12], [0.07, 0.05, 0.13]], tag: 'brow', k: 0.05 }, { e: [[-0.11, 0.13, 0.12], [0.07, 0.05, 0.13]], tag: 'brow', k: 0.05 },
    { c: [[0, -0.13, 0.02], [0, -0.27, 0.42], 0.1, 0.05], tag: 'jaw', k: 0.04 }, // lower jaw, dropped open
    { e: [[0.17, -0.04, -0.02], [0.06, 0.13, 0.1]], tag: 'frill', k: 0.06 }, { e: [[-0.17, -0.04, -0.02], [0.06, 0.13, 0.1]], tag: 'frill', k: 0.06 },
  ], 0.09)
  const antler = (s) => curve([[s * 0.09, 0.17, -0.06], [s * 0.16, 0.34, -0.22], [s * 0.2, 0.42, -0.46], [s * 0.17, 0.52, -0.68]])
  const antlers = [antler(1), antler(-1)]
  const barbel = (s) => curve([[s * 0.07, 0.0, 0.52], [s * 0.3, 0.06, 0.46], [s * 0.58, -0.06, 0.26], [s * 0.82, -0.22, 0.02], [s * 1.0, -0.18, -0.24], [s * 1.12, -0.3, -0.45]])
  const barbels = [barbel(1), barbel(-1)]
  const LEGS = [[0.13, 1], [0.13, -1], [0.5, 1], [0.5, -1]]

  return build(n, 591, [
    [40, (r) => { // the body: scales on the back and flanks, banded belly plates below
      let s = r()
      for (let t = 0; t < 4 && r() > radius(s) / 0.15; t++) s = r() // more particles where it's thicker
      const F = frameAt(s), a = r() * TAU, R = radius(s)
      const nn = add(mul(F.up, Math.cos(a)), mul(F.side, Math.sin(a)))
      const belly = Math.cos(a) < -0.45
      const row = s * total * 16, ring = (a / TAU) * 14 + (Math.floor(row) % 2) * 0.5
      const edge = Math.min(row % 1, Math.abs((ring % 1) - 0.5) * 2) < 0.16 // scale outlines
      const p = add(F.c, mul(nn, R * (1 + (edge ? 0 : 0.04))))
      const sh = shadeOf(nn)
      if (belly) return V(p, 1, (row * 0.6) % 1 < 0.18 ? sh * 0.55 : sh, s, -1, 46)
      return V(p, edge ? 3 : 0, edge ? sh * 0.8 : Math.min(0.98, sh * 1.1), s, -1, 46)
    }],
    [7, (r) => { // dorsal spines: gilt blades along the back, shrinking to the tail
      const k = Math.floor(r() * 46), s = 0.03 + (k / 46) * 0.9, F = frameAt(s), R = radius(s)
      const h = R * 1.1 * (1 - s * 0.5), u = r(), w = (r() - 0.5) * (1 - u)
      const p = add(add(F.c, mul(F.up, R + u * h)), mul(F.tn, -u * h * 0.6 + w * R * 0.9))
      return V(p, 1, u > 0.85 || Math.abs(w) > 0.4 ? 0.95 : 0.55 + u * 0.3, s, -1, 46)
    }],
    [6, (r) => { // four legs, each with three gilt claws
      const [s, side] = LEGS[Math.floor(r() * 4)], F = frameAt(s), R = radius(s)
      const hip = add(F.c, mul(F.side, side * R * 0.8))
      const knee = add(add(hip, mul(F.side, side * 0.16)), mul(F.up, -0.12))
      const foot = add(add(knee, mul(F.up, -0.16)), mul(F.tn, -0.08))
      const q = r()
      if (q < 0.8) {
        const [a, b, ra, rb] = q < 0.4 ? [hip, knee, 0.06, 0.045] : [knee, foot, 0.045, 0.03]
        const d = sub(b, a), t = r(), ref = norm(cross(d, F.tn)), e2 = norm(cross(d, ref)), ang = r() * TAU
        const nn = add(mul(ref, Math.cos(ang)), mul(e2, Math.sin(ang)))
        return V(add(add(a, mul(d, t)), mul(nn, lerp(ra, rb, t))), 0, shadeOf(nn), s, -1, 46)
      }
      const c = Math.floor(r() * 3) - 1, t = r()
      const dir = norm(add(add(mul(F.tn, -0.6 + c * 0.05), mul(F.side, side * 0.5 + c * 0.35)), mul(F.up, -0.4)))
      return V(add(add(foot, mul(dir, t * 0.11)), mul(F.up, -t * t * 0.03)), 2, 0.9, s, -1, 46)
    }],
    [5, (r) => { // the flaming tail tuft and the mane along the neck
      if (r() < 0.55) {
        const s = 0.95 + r() * 0.05, F = frameAt(s), d = randomOnSphere(r), l = Math.abs(gauss(r)) * 0.16
        return V(add(add(F.c, mul(d, l)), mul(F.tn, l * 0.8)), r() < 0.4 ? 4 : 1, 0.7, s, -1, 46)
      }
      const s = r() * 0.16, F = frameAt(s), a = (r() - 0.5) * 2.6, l = (0.08 + Math.abs(gauss(r)) * 0.12) * (1 - s * 3)
      const dir = add(mul(F.up, Math.cos(a)), mul(F.side, Math.sin(a)))
      return V(add(add(F.c, mul(dir, radius(s) + l)), mul(F.tn, l * 0.7)), 1, 0.5 + r() * 0.4, s, -1, 46)
    }],
    [10, (r) => { // the head
      const { p, n: nn, tag, ao } = head.sample(r)
      const wn = toWorldN(nn), sh = shadeOf(wn) * lerp(0.35, 1, ao)
      const tint = tag === 'brow' || tag === 'frill' || (tag === 'jaw' && nn[1] < -0.3) ? 1 : tag === 'nostril' ? 3 : 0
      const lip = tag === 'snout' && p[1] < -0.04 && nn[1] < 0
      return V(toWorld(p), lip ? 3 : tint, sh * (0.7 + fbm(mul(p, 18)) * 0.3), -1, -1, 47)
    }],
    [3, (r) => { // antler horns
      const c = antlers[r() < 0.5 ? 0 : 1], t = r(), branch = r() < 0.25
      let q = c(t)
      if (branch) { const b = c(0.45), t2 = r(); q = add(b, [Math.sign(b[0]) * t2 * 0.05, t2 * 0.18, t2 * 0.02]) }
      const d = randomOnSphere(r), rr = lerp(0.035, 0.01, branch ? 0.6 : t)
      return V(toWorld(add(q, mul(d, rr))), 1, shadeOf(toWorldN(d)) + 0.1, -1, -1, 47)
    }],
    [2, (r) => { // eyes and teeth
      if (r() < 0.5) { const s = r() < 0.5 ? -1 : 1, d = randomOnSphere(r); return V(toWorld(add([s * 0.135, 0.1, 0.2], mul(d, 0.03 * Math.sqrt(r())))), 4, 0.95, -1, -1, 47) }
      const s = r() < 0.5 ? -1 : 1, t = r(), up = r() < 0.5
      return V(toWorld([s * lerp(0.09, 0.06, t), up ? -0.06 - r() * 0.04 : -0.14 + r() * 0.04, lerp(0.15, 0.45, t)]), 2, 0.9, -1, -1, 47)
    }],
    [4, (r) => { const c = barbels[r() < 0.5 ? 0 : 1], t = r(); return V(toWorld(add(c(t), mul(randomOnSphere(r), 0.008))), 1, 0.85 - t * 0.3, t, -1, 48) }], // barbels
    [1, (r) => { const d = randomOnSphere(r), k = 2 + r() * 0.3; return V([d[0] * k, d[1] * k * 0.75, d[2] * k * 0.5], 4, 0.9, r(), -1, 8) }], // drifting embers
    [14, (r) => { // fire: a white-hot core inside gold flame with red tongues at its edge (placed by the shader)
      const b = r(), tint = b < 0.3 ? 4 : b < 0.75 ? 1 : 0
      return V(DRAGON_FIRE.mouth, tint, 0.65 + r() * 0.33, r(), b, 49)
    }],
  ])
}
