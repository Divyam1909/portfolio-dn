// Intro forms: a jellyfish, a samurai helmet and mask, and an eastern dragon. Output matches
// hero.js: { pos, order } with order = (tint + shade, a, b, part); motion lives in heroAnim.

import { gauss, randomOnSphere } from './shapes.js'
import { TAU, clamp, lerp, sstep, sub, add, mul, dot, len, norm, cross, fbm, setView, shadeOf, T, makeSculpt, build, curve, tangent } from './fauna.js'

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
   SAMURAI — a kabuto helmet with its menpō face mask: a ridged lacquered bowl, a peaked visor,
   swept-back side wings, a five-tier neck guard laced in gold, tall crescent horns around a sun
   crest, and a snarling red mask with heavy brows, open mouth and teeth, a white moustache and
   beard, and eyes that smoulder from the dark. Eyes: part 44. Moustache and beard: part 45.
   ========================================================================================== */
export function samurai(n) {
  setView(0, 0, 0)
  const DY = -0.18 // centre the whole piece
  const face = makeSculpt([
    { e: [[0, -0.12, 0.22], [0.5, 0.62, 0.42]], tag: 'face' },
    { e: [[0.3, -0.22, 0.42], [0.19, 0.17, 0.16]], tag: 'face', k: 0.12 }, { e: [[-0.3, -0.22, 0.42], [0.19, 0.17, 0.16]], tag: 'face', k: 0.12 },
    { c: [[0.44, 0.27, 0.42], [0.04, 0.12, 0.62], 0.08, 0.06], tag: 'brow', k: 0.06 }, { c: [[-0.44, 0.27, 0.42], [-0.04, 0.12, 0.62], 0.08, 0.06], tag: 'brow', k: 0.06 },
    { c: [[0, 0.12, 0.62], [0, -0.14, 0.78], 0.055, 0.09], tag: 'nose', k: 0.05 },
    { e: [[0.085, -0.17, 0.72], [0.07, 0.05, 0.06]], tag: 'nose', k: 0.04 }, { e: [[-0.085, -0.17, 0.72], [0.07, 0.05, 0.06]], tag: 'nose', k: 0.04 },
    { e: [[0, -0.44, 0.58], [0.3, 0.12, 0.12]], tag: 'mouth', k: 0.07 },
    { e: [[0, -0.72, 0.42], [0.24, 0.16, 0.18]], tag: 'chin', k: 0.1 },
    { e: [[0.27, 0.05, 0.5], [0.13, 0.09, 0.08]], tag: 'socket', k: 0.06 }, { e: [[-0.27, 0.05, 0.5], [0.13, 0.09, 0.08]], tag: 'socket', k: 0.06 },
  ], 0.1)
  // slanted, angry eye holes and the open mouth, in the mask's front plane
  const eyeIn = (x, y) => { const s = Math.sign(x) || 1, dx = x - s * 0.25, dy = y - 0.06, a = s * 0.32, u = dx * Math.cos(a) + dy * Math.sin(a), v = -dx * Math.sin(a) + dy * Math.cos(a); return (u / 0.12) ** 2 + (v / 0.045) ** 2 }
  const mouthIn = (x, y) => (x / 0.22) ** 2 + ((y + 0.45) / (0.06 + 0.02 * Math.cos(x * 7))) ** 2
  const BOWL = { c: [0, 0.4, -0.08], r: [0.66, 0.6, 0.72] }
  const horn = (s) => curve([[s * 0.12, 0.6, 0.68], [s * 0.45, 0.82, 0.7], [s * 0.78, 1.18, 0.62], [s * 0.88, 1.58, 0.5], [s * 0.74, 1.92, 0.4]])
  const hornC = [horn(1), horn(-1)]
  const out = (p, tint, sh, a = -1, part = 0) => V([p[0], p[1] + DY, p[2]], tint, sh, a, -1, part)
  return build(n, 581, [
    [28, (r) => { // the mask
      for (let t = 0; t < 12; t++) {
        const { p, n: nn, tag, ao } = face.sample(r)
        if (nn[2] < 0.05 || p[2] < 0.12) continue // a mask has no back
        if (eyeIn(p[0], p[1]) < 1 || mouthIn(p[0], p[1]) < 1) continue // holes
        const sh = shadeOf(nn) * lerp(0.35, 1, ao)
        const edge = eyeIn(p[0], p[1]) < 1.5 || mouthIn(p[0], p[1]) < 1.35
        const lacquer = fbm([p[0] * 6, p[1] * 6, p[2] * 6])
        if (tag === 'brow' && nn[1] > 0.2) return out(p, 1, sh, -1, 0) // gilded brow ridges
        return out(p, 0, edge ? Math.min(0.98, sh + 0.4) : Math.min(0.98, sh * (0.95 + lacquer * 0.4)))
      }
      return out([0, -0.12, 0.64], 0, 0.5)
    }],
    [3, (r) => { // gilt creases: the snarl lines from the nose to the mouth corners, and the cheek folds
      const s = r() < 0.5 ? -1 : 1, k = Math.floor(r() * 3), t = r()
      const lines = [[[0.12, -0.12, 0.72], [0.22, -0.3, 0.66], [0.26, -0.44, 0.6]], [[0.36, -0.08, 0.56], [0.42, -0.24, 0.5], [0.4, -0.4, 0.46]], [[0.14, 0.27, 0.62], [0.06, 0.33, 0.62], [0, 0.36, 0.6]]]
      const c = curve(lines[k].map(([x, y, z]) => face.project([s * x, y, z + 0.05])))
      const q = c(t), nn = face.grad(q)
      return out(add(q, mul(nn, 0.008)), 1, 0.75 + r() * 0.2, -1, 0)
    }],
    [3, (r) => { // teeth: an upper and a lower row, and the fangs
      const up = r() < 0.5, x = (r() * 2 - 1) * 0.2, k = Math.round((x + 0.2) / 0.05), cx = k * 0.05 - 0.2
      const fang = Math.abs(Math.abs(cx) - 0.15) < 0.01, h = fang ? 0.07 : 0.035
      const y = up ? -0.4 - r() * h : -0.5 + r() * h
      return out([cx + (r() - 0.5) * 0.035, y, 0.6 - Math.abs(cx) * 0.4], 2, 0.85, -1, 0)
    }],
    [3, (r) => { const s = r() < 0.5 ? -1 : 1, a = r() * TAU, rr = Math.sqrt(r()), u = Math.cos(a) * rr * 0.1, v = Math.sin(a) * rr * 0.035, ang = s * 0.32; return out([s * 0.25 + u * Math.cos(ang) - v * Math.sin(ang), 0.06 + u * Math.sin(ang) + v * Math.cos(ang), 0.47], 4, 0.95, rr, 44) }], // eyes
    [8, (r) => { // moustache and beard: white hair, combed out and down
      const q = r(), s = r() < 0.5 ? -1 : 1, t = Math.pow(r(), 0.8)
      if (q < 0.62) { const root = [s * (0.04 + r() * 0.08), -0.3, 0.74], tip = [s * (0.55 + r() * 0.1), -0.62 - r() * 0.15, 0.5]
        const c = curve([root, [s * 0.25, -0.3 - r() * 0.05, 0.72], [s * 0.45, -0.42, 0.62], tip])
        return out(add(c(t), mul(randomOnSphere(r), 0.01)), 2, 0.75 - t * 0.25, t, 45) }
      const x = (r() * 2 - 1) * 0.26, root = [x, -0.76 - Math.abs(x) * 0.25, 0.52 - Math.abs(x) * 0.3]
      const p = add(root, [x * t * 0.4, -t * 0.3, t * 0.04 - t * t * 0.08])
      return out(add(p, mul(randomOnSphere(r), 0.012)), 2, 0.5 - t * 0.25, t, 45)
    }],
    [16, (r) => { // helmet bowl: lacquer between raised gilt ridges (suji-bachi), with a crowning ring
      let d = randomOnSphere(r); if (d[1] < 0.05) d = [d[0], -d[1] + 0.05, d[2]]
      const p = add(BOWL.c, [d[0] * BOWL.r[0], d[1] * BOWL.r[1], d[2] * BOWL.r[2]])
      const ph = Math.atan2(d[2], d[0]), ridge = Math.abs(((ph * 32) / TAU) % 1) < 0.16 || d[1] > 0.93
      return out(p, ridge ? 1 : 3, shadeOf(norm(d)) * (ridge ? 1 : 0.85), -1, 0)
    }],
    [5, (r) => { // visor: a peaked brim sweeping forward over the brow
      const a = lerp(-1.3, 1.3, r()), t = r(), rad = lerp(0.68, 0.98, t), y = 0.45 - t * 0.13 + Math.cos(a) * 0.03
      const p = [BOWL.c[0] + Math.sin(a) * rad, y, BOWL.c[2] + Math.cos(a) * rad * 1.08]
      return out(p, t > 0.92 ? 1 : 0, shadeOf(norm([Math.sin(a) * 0.3, 1, Math.cos(a) * 0.3])) * 0.9, -1, 0)
    }],
    [5, (r) => { // fukigaeshi: the side wings turned back from the neck guard
      const s = r() < 0.5 ? -1 : 1, u = r(), v = r()
      const p = [s * (0.72 + u * 0.2), 0.4 - v * 0.42, 0.25 - u * 0.25 + v * 0.05]
      const edge = u > 0.9 || v < 0.06 || v > 0.94
      return out(p, edge ? 1 : 0, edge ? 0.95 : shadeOf(norm([s, 0, 0.6])), -1, 0)
    }],
    [12, (r) => { // shikoro: five tiers of lames flaring out around the sides and back, laced in gold
      const k = Math.floor(r() * 5), a = lerp(0.95, TAU - 0.95, r()), v = r()
      const rad = 0.7 + k * 0.075 + v * 0.06, y = 0.34 - k * 0.15 - v * 0.14
      const p = [Math.sin(a) * rad, y, BOWL.c[2] + Math.cos(a) * rad]
      const lace = Math.abs(((a * 22) / TAU) % 1 - 0.5) < 0.08 || v > 0.93
      return out(p, lace ? 1 : 0, lace ? 0.9 : shadeOf(norm([Math.sin(a), 0.4, Math.cos(a)])) * (0.6 + v * 0.4), -1, 0)
    }],
    [10, (r) => { // kuwagata: two tall flat crescent horns, rimmed, around a gilt sun crest
      const q = r()
      if (q < 0.25) { const a = r() * TAU, rr = Math.sqrt(r()) * 0.17, rim = r() < 0.3; return out([Math.cos(a) * (rim ? 0.17 : rr), 0.86 + Math.sin(a) * (rim ? 0.17 : rr), 0.72], rim ? 4 : 1, rim ? 0.95 : 0.6 + rr, -1, 0) }
      const c = hornC[r() < 0.5 ? 0 : 1], t = r(), w = r() * 2 - 1, tn = tangent(c, t)
      const side = norm(cross(tn, [0, 0, 1])), width = lerp(0.13, 0.02, Math.pow(t, 0.8))
      const p = add(c(t), mul(side, w * width))
      return out(p, 1, Math.abs(w) > 0.85 ? 0.98 : 0.45 + 0.3 * (1 - Math.abs(w)), -1, 0)
    }],
    [5, (r) => { // yodare-kake: the throat guard's three plates under the chin
      const k = Math.floor(r() * 2), a = lerp(-1.25, 1.25, r()), rad = 0.42 + k * 0.08
      const p = [Math.sin(a) * rad, -0.86 - k * 0.11 - r() * 0.09, 0.08 + Math.cos(a) * rad * 0.8]
      const edge = Math.abs(Math.abs(a) - 1.25) < 0.05
      return out(p, edge ? 1 : 0, edge ? 0.9 : shadeOf(norm([Math.sin(a), -0.2, Math.cos(a)])) * 0.75, -1, 0)
    }],
  ])
}

/* ============================================================================================
   DRAGON — an eastern lung dragon coiling through the air: a long serpent body with overlapping
   scales and a pale banded belly, gilt dorsal spines, four clawed legs, a flaming tail tuft and a
   long-snouted head with antler horns, a mane, glowing eyes, teeth and trailing barbels.
   Body, legs, spines, tail: part 46 (a = 0 neck … 1 tail tip). Head: part 47. Barbels: part 48
   (a = along).
   ========================================================================================== */
export const DRAGON_VIEW = [0.15, -0.35]
export function dragon(n) {
  setView(...DRAGON_VIEW)
  const body = curve([[-1.25, 0.95, 0.55], [-0.55, 1.15, 0.15], [0.3, 0.75, -0.35], [0.95, 0.05, 0.1], [0.45, -0.6, 0.65], [-0.45, -0.75, 0.25], [-1.05, -0.3, -0.35], [-0.45, 0.15, -0.8], [0.55, -0.15, -0.65], [1.3, -0.75, -0.2], [1.85, -0.45, 0.35]])
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
  // head: sculpted in its own frame (x side, y up, z forward), then placed at the neck
  const F0 = frameAt(0), fwd = mul(F0.tn, -1), hUp = F0.up, hSide = cross(hUp, fwd)
  const toWorld = (q) => add(add(add(add(F0.c, mul(fwd, q[2] + 0.12)), mul(hUp, q[1])), mul(hSide, q[0])), [0, 0, 0])
  const toWorldN = (q) => norm(add(add(mul(fwd, q[2]), mul(hUp, q[1])), mul(hSide, q[0])))
  const head = makeSculpt([
    { e: [[0, 0.03, 0], [0.19, 0.16, 0.22]], tag: 'skull' },
    { c: [[0, 0.02, 0.12], [0, -0.01, 0.5], 0.14, 0.095], tag: 'snout' },
    { e: [[0, 0.01, 0.53], [0.11, 0.08, 0.07]], tag: 'snout', k: 0.05 },
    { e: [[0.06, 0.07, 0.55], [0.04, 0.03, 0.03]], tag: 'nostril', k: 0.03 }, { e: [[-0.06, 0.07, 0.55], [0.04, 0.03, 0.03]], tag: 'nostril', k: 0.03 },
    { e: [[0.11, 0.13, 0.12], [0.07, 0.05, 0.13]], tag: 'brow', k: 0.05 }, { e: [[-0.11, 0.13, 0.12], [0.07, 0.05, 0.13]], tag: 'brow', k: 0.05 },
    { c: [[0, -0.13, 0.02], [0, -0.22, 0.44], 0.1, 0.055], tag: 'jaw', k: 0.04 },
    { e: [[0.17, -0.04, -0.02], [0.06, 0.13, 0.1]], tag: 'frill', k: 0.06 }, { e: [[-0.17, -0.04, -0.02], [0.06, 0.13, 0.1]], tag: 'frill', k: 0.06 },
  ], 0.09)
  const antler = (s) => curve([[s * 0.09, 0.17, -0.06], [s * 0.16, 0.34, -0.22], [s * 0.2, 0.42, -0.46], [s * 0.17, 0.52, -0.68]])
  const antlers = [antler(1), antler(-1)]
  const barbel = (s) => curve([[s * 0.07, 0.0, 0.52], [s * 0.3, 0.06, 0.46], [s * 0.58, -0.06, 0.26], [s * 0.82, -0.22, 0.02], [s * 1.0, -0.18, -0.24], [s * 1.12, -0.3, -0.45]])
  const barbels = [barbel(1), barbel(-1)]
  const LEGS = [[0.13, 1], [0.13, -1], [0.5, 1], [0.5, -1]]

  return build(n, 591, [
    [46, (r) => { // the body: scales on the back and flanks, banded belly plates below
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
  ])
}
