// Intro forms built from geometry rather than sculpted: atom, black hole, gears, hourglass,
// tesseract, wormhole and turntable. Output matches hero.js: { pos, order } with
// order = (tint + shade, a, b, part). Anything that moves is described here in rest position and
// animated in the shader (heroAnim in scene.js) from the constants exported next to each form.

import { gauss, randomOnSphere } from './shapes.js'
import { TAU, clamp, lerp, sstep, add, mul, len, norm, cross, fbm, setView, shadeOf, T, build, curve, tangent, frame } from './fauna.js'

const V = (p, tint, sh, a = -1, b = -1, part = 0) => [p[0], p[1], p[2], T(tint, sh), a, b, part]
const jit = (r, p, s) => [p[0] + gauss(r) * s, p[1] + gauss(r) * s, p[2] + gauss(r) * s]
// an orthonormal pair spanning the plane perpendicular to n
function basis(n) {
  const e1 = norm(cross(n, Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]))
  return [e1, cross(n, e1)]
}
// a point on the surface of a tapered tube from a to b, with its outward normal
function tubePt(r, a, b, ra, rb) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], [e1, e2] = basis(norm(d))
  const t = r(), ang = r() * TAU, rad = lerp(ra, rb, t)
  const nn = add(mul(e1, Math.cos(ang)), mul(e2, Math.sin(ang)))
  return { p: add(add(a, mul(d, t)), mul(nn, rad)), n: nn, t }
}

/* ============================================================================================
   ATOM — the classic emblem made physical: a carbon nucleus of six protons and six neutrons
   (packed, jiggling) and three tilted circular orbits, each carrying two electrons with comet
   trails. Nucleons: part 30 (a = index). Electrons: part 31 (a = orbit, b = 0 head … 1 tail).
   ========================================================================================== */
const ATOM_R = 1.72, ATOM_TILT = Math.acos(0.34)
export const ATOM_ORBITS = [0, 1, 2].map((k) => {
  const f = (k * Math.PI) / 3 + 0.3
  return { n: [Math.sin(ATOM_TILT) * Math.sin(f), -Math.sin(ATOM_TILT) * Math.cos(f), Math.cos(ATOM_TILT)], w: [1.9, -1.55, 1.25][k] }
})
export function atom(n) {
  setView(0, 0, 0)
  const rings = ATOM_ORBITS.map(({ n: nn }) => basis(nn))
  const ring = (k, th) => { const [e1, e2] = rings[k]; return add(mul(e1, Math.cos(th) * ATOM_R), mul(e2, Math.sin(th) * ATOM_R)) }
  // twelve nucleons packed as an icosahedron's vertices around a small core
  const G = (1 + Math.sqrt(5)) / 2
  const ico = [[-1, G, 0], [1, G, 0], [-1, -G, 0], [1, -G, 0], [0, -1, G], [0, 1, G], [0, -1, -G], [0, 1, -G], [G, 0, -1], [G, 0, 1], [-G, 0, -1], [-G, 0, 1]]
  const NUC = ico.map((v) => mul(norm(v), 0.27)), NR = 0.165
  return build(n, 501, [
    [26, (r) => { // nucleons: alternating proton / neutron spheres, buried parts skipped
      let k = 0, d = [0, 1, 0], p = NUC[0]
      for (let t = 0; t < 10; t++) {
        k = Math.floor(r() * NUC.length); d = randomOnSphere(r); p = add(NUC[k], mul(d, NR))
        if (!NUC.some((c, j) => j !== k && len([p[0] - c[0], p[1] - c[1], p[2] - c[2]]) < NR * 0.98)) break
      }
      const proton = [0, 3, 5, 6, 8, 10].includes(k)
      return V(p, proton ? 0 : 2, shadeOf(d) * (proton ? 1 : 0.8), k, -1, 30)
    }],
    [5, (r) => { const d = randomOnSphere(r), rr = 0.5 + Math.abs(gauss(r)) * 0.55; return V(mul(d, rr), 1, 0.12 + 0.2 * Math.exp(-rr), -1, -1, 0) }], // a faint charge cloud
    [30, (r) => { // the three orbits, as fine bright rings
      const k = Math.floor(r() * 3)
      return V(jit(r, ring(k, r() * TAU), 0.007), 1, 0.4 + r() * 0.15, -1, -1, 0)
    }],
    [16, (r) => { // electrons: a glowing head and a fading trail behind it
      const k = Math.floor(r() * 3), e = r() < 0.5 ? 0 : 1, head = k * 2.1 + e * Math.PI
      const u = r() < 0.18 ? 0 : Math.pow(r(), 1.7)
      const th = head - Math.sign(ATOM_ORBITS[k].w) * u * 1.25
      const p = u === 0 ? add(ring(k, head), mul(randomOnSphere(r), 0.05 * Math.sqrt(r()))) : jit(r, ring(k, th), 0.012 * (1 - u))
      return V(p, 4, 0.95, k, u, 31)
    }],
  ])
}

/* ============================================================================================
   BLACK HOLE — a Gargantua-style view: a thin, flaring accretion disk of fine concentric lanes,
   white-hot at its inner edge and cooling to orange, with hot spots riding it; the disk's far
   side lensed into a bright band arching over the shadow and a thinner one beneath it; a sharp
   photon ring with a faint inner echo; and background stars pushed into an Einstein ring.
   The disk turns faster the closer it is (Keplerian), its approaching side beamed brighter.
   Disk: part 32 (a = radius, b = random). Lensed light, ring and stars: part 33, in view space
   (a = radius, b = angle). Infalling gas: part 34 (a = phase, b = start angle).
   ========================================================================================== */
export const HOLE = { tilt: 0.17, shadow: 0.84, ring: 0.9, inner: 1.18, outer: 2.6 }
export function blackHole(n) {
  setView(HOLE.tilt, 0, 0)
  const { inner, outer, ring } = HOLE
  // the disk's look at radius rad and angle ph: temperature, fine lanes and turbulent streaks
  const look = (rad, ph) => {
    const hot = Math.pow(inner / rad, 1.7)
    const lanes = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(rad * 58 + Math.sin(rad * 7) * 2), 1.6)
    const streak = 0.6 + 0.4 * fbm([Math.cos(ph) * rad * 2.2, Math.sin(ph) * rad * 2.2, rad * 3])
    const b = (0.12 + hot * 0.86) * lanes * streak
    return { tint: hot > 0.85 ? 4 : hot > 0.4 ? 1 : 0, sh: clamp(b, 0.04, 0.98) }
  }
  const SPOTS = [0, 1, 2, 3, 4].map((k) => ({ rad: lerp(inner + 0.12, inner + 0.75, k / 4), ph: k * 2.4 }))
  return build(n, 511, [
    [44, (r) => { // the disk, denser and hotter inward, flaring a little with radius
      const rad = inner + (outer - inner) * Math.pow(r(), 1.9), ph = r() * TAU, L = look(rad, ph)
      const fade = 1 - sstep(outer - 0.45, outer, rad) * 0.85
      return V([Math.cos(ph) * rad, gauss(r) * 0.006 * rad * rad, Math.sin(ph) * rad], L.tint, L.sh * fade, rad, r(), 32)
    }],
    [3, (r) => { // hot spots riding the inner disk
      const S = SPOTS[Math.floor(r() * SPOTS.length)], d = gauss(r) * 0.05, ph = S.ph + gauss(r) * 0.07, rad = S.rad + d
      return V([Math.cos(ph) * rad, gauss(r) * 0.01, Math.sin(ph) * rad], 4, 0.9, rad, r(), 32)
    }],
    [30, (r) => { // the far side of the disk, bent over the top (broad) and under the bottom (thin)
      const top = r() < 0.72, ps = r() * Math.PI, a = top ? ps : -ps
      const q = Math.pow(r(), 1.3), w = top ? 0.38 * Math.pow(Math.sin(ps), 0.45) + 0.04 : 0.1 * Math.pow(Math.sin(ps), 0.6) + 0.02
      const rad = ring + 0.035 + w * q, L = look(inner + q * (outer - inner) * 0.7, a * 3)
      return V([Math.cos(a) * rad, Math.sin(a) * rad * 1.02, 0], L.tint, Math.min(0.98, (0.25 + L.sh * 1.3) * (top ? 1 : 0.75) * (1 - q * 0.35)), rad, a, 33)
    }],
    [6, (r) => { // photon ring, crisp, with a faint second image just inside it
      const a = r() * TAU, echo = r() < 0.25, rad = echo ? ring - 0.035 : ring + Math.abs(gauss(r)) * 0.006
      return V([Math.cos(a) * rad, Math.sin(a) * rad, 0], 4, echo ? 0.45 : 0.98, rad, a, 33)
    }],
    [4, (r) => { // background stars, lensed: pushed outward into arcs around the Einstein ring
      const k = Math.floor(r() * 140), ang0 = hash(k, 1) * TAU, r0 = 0.15 + hash(k, 2) * 2.5
      const E = 1.12, rr = (r0 + Math.sqrt(r0 * r0 + 4 * E * E)) / 2, stretch = 0.03 + 0.5 * Math.exp(-(rr - E) * 3) // tangential smear
      const a = ang0 + (r() - 0.5) * stretch, rad = rr + gauss(r) * 0.004
      return V([Math.cos(a) * rad, Math.sin(a) * rad, -0.6], 2, 0.25 + hash(k, 3) * 0.5, rad, a, 33)
    }],
    [5, (r) => V([0, 0, 0], 0, 0.45 + r() * 0.3, r(), r() * TAU, 34)],
  ])
}
const hash = (k, s) => { const x = Math.sin(k * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x) }

/* ============================================================================================
   GEARS — a working train of four spur gears (20, 12, 8 and 10 teeth, one module), meshing
   tooth-in-gap and turning at their true ratios: a spoked brass wheel driving a steel pinion,
   a copper pinion and a steel idler, each with its hub, axle and bolt heads.
   Particles: part 35 with a = gear index.
   ========================================================================================== */
const GM = 0.1, GT = 0.2 // module (pitch diameter / teeth) and face width
export const GEARS = (() => {
  const g = [{ N: 20, c: [-0.58, -0.32], th: 0, w: 0.32, tint: 0 }]
  const mesh = (i, N, ang, tint) => { // place a gear against gear i so a tooth sits in a gap
    const a = g[i], d = (GM * (a.N + N)) / 2
    g.push({ N, c: [a.c[0] + Math.cos(ang) * d, a.c[1] + Math.sin(ang) * d], th: ang + Math.PI - (Math.PI - a.N * (ang - a.th)) / N, w: (-a.w * a.N) / N, tint })
  }
  mesh(0, 12, 0.62, 2)
  mesh(1, 8, -1.02, 1)
  mesh(0, 10, 2.25, 2)
  for (const q of g) { q.c[0] += 0.12; q.c[1] += 0.0 }
  return g
})()
export const GEAR_VIEW = [0.2, -0.42]
export function gears(n) {
  setView(...GEAR_VIEW)
  const prof = (G, ph) => { // tooth profile: rounded trapezoid teeth between root and tip circles
    const R = (GM * G.N) / 2, u = Math.abs((((G.N * (ph - G.th)) / TAU) % 1 + 1.5) % 1 - 0.5)
    return lerp(R + GM, R - 1.25 * GM, sstep(0.14, 0.34, u))
  }
  const W = GEARS.map((G) => Math.pow(G.N, 1.7)), Wt = W.reduce((a, b) => a + b, 0)
  const pick = (r) => { let x = r() * Wt, k = 0; while (x > W[k] && k < W.length - 1) x -= W[k++]; return k }
  return build(n, 521, [[1, (r) => {
    const k = pick(r), G = GEARS[k], R = (GM * G.N) / 2, root = R - 1.25 * GM
    const spoked = G.N >= 12, rimIn = root - (spoked ? 0.13 : 0), hubR = spoked ? 0.2 : 0.14, bore = 0.065
    const at = (rad, ph, z) => [G.c[0] + Math.cos(ph) * rad, G.c[1] + Math.sin(ph) * rad, z]
    const face = () => (r() < 0.5 ? -1 : 1) * GT * 0.5
    const out = (p, nn, sh = 0) => V(p, G.tint, clamp(shadeOf(nn) + sh, 0.04, 0.98), k, -1, 35)
    const q = r(), ph = r() * TAU
    if (q < 0.22) { const z = face(); return out(at(prof(G, ph), ph, z), [0, 0, Math.sign(z)], 0.35) } // crisp tooth outline
    if (q < 0.4) { const rad = prof(G, ph); return out(at(rad, ph, (r() - 0.5) * GT), [Math.cos(ph), Math.sin(ph), 0], 0.05) } // flanks
    if (q < 0.5) { const z = face(), rad = [rimIn, hubR, bore][Math.floor(r() * (spoked ? 3 : 2)) + (spoked ? 0 : 1)]; return out(at(rad, ph, z), [0, 0, Math.sign(z)], 0.3) } // inner edges
    if (q < 0.87) { // the web: rim band, spokes and hub on both faces
      const z = face()
      if (!spoked) { const rad = Math.sqrt(lerp(bore * bore, rimIn * rimIn, r())); return out(at(Math.min(rad, prof(G, ph)), ph, z), [0, 0, Math.sign(z)], -0.08) }
      const s = r()
      if (s < 0.5) { const rad = lerp(rimIn, prof(G, ph), r()); return out(at(rad, ph, z * 0.9), [0, 0, Math.sign(z)], -0.05) }
      if (s < 0.72) { const rad = lerp(bore, hubR, Math.sqrt(r())); return out(at(rad, ph, z * 1.15), [0, 0, Math.sign(z)], 0) }
      const sp = Math.floor(r() * 5), base = G.th + (sp / 5) * TAU, rad = lerp(hubR, rimIn, r()), wdt = (r() - 0.5) * 0.09
      const p = add(at(rad, base, z * 0.7), [-Math.sin(base) * wdt, Math.cos(base) * wdt, 0])
      return out(p, [0, 0, Math.sign(z)], Math.abs(wdt) > 0.04 ? 0.25 : -0.05)
    }
    if (q < 0.9) { const zz = lerp(-0.42, -GT * 0.5, r()); return out(at(bore * 0.9, ph, zz), [Math.cos(ph), Math.sin(ph), 0], 0.1) } // axle
    const b = Math.floor(r() * 4), bp = G.th + (b / 4) * TAU + 0.4, br = (hubR + bore) / 2 // bolt heads on the hub
    const a2 = r() * TAU, rr = 0.026 * Math.sqrt(r())
    return out(add(at(br, bp, GT * 0.62), [Math.cos(a2) * rr, Math.sin(a2) * rr, 0]), [0, 0, 1], 0.25)
  }]])
}

/* ============================================================================================
   HOURGLASS — two blown-glass bulbs in a turned frame of plates and beaded posts, before a clock
   face that keeps the visitor's real time. The sand runs from the top bulb through the neck into
   a growing cone, then the glass turns over and the sand slides back down to begin again.
   Sand: part 36 (a = grain rank, b = random), placed entirely by the shader from the profile
   below. Clock: part 50 (a = 0 face, 1 hour, 2 minute, 3 second hand), which never turns over.
   ========================================================================================== */
export const GLASS = { H: 1.02, RB: 0.66, RN: 0.05 }
export const CLOCK = { R: 1.62, Z: -0.85 }
export const glassR = (y) => GLASS.RN + (GLASS.RB - GLASS.RN) * Math.pow(Math.sin(Math.PI * clamp(Math.abs(y) / GLASS.H, 0, 1) * 0.85), 0.75)
export function hourglass(n) {
  // shading depends only on facing the camera, so the half-turn at the end of each cycle is seamless
  const lit = (nn) => clamp(0.2 + 0.7 * Math.max(0, nn[2]) + 0.25 * Math.pow(1 - Math.abs(nn[2]), 3), 0.04, 0.98)
  const { H } = GLASS, PY = H + 0.07, PR = 0.86, POST = 0.74, { R, Z } = CLOCK
  const postR = (y) => 0.034 + 0.022 * Math.pow(Math.cos(y * 7.5), 2) // beaded, turned posts
  const hand = (r, len, w, tail) => { // a tapered hand pointing up (+y), with a short counterweight tail
    const t = lerp(-tail, len, r()), half = w * (t < 0 ? 0.8 : 1 - 0.75 * (t / len)), x = (r() * 2 - 1) * half
    return [x, t, Z + 0.02, Math.abs(x) > half * 0.8]
  }
  return build(n, 531, [
    [30, (r) => V([0, 0, 0], 1, 0.45 + r() * 0.5, r(), r(), 36)], // sand
    [16, (r) => { // glass: bright at the silhouette and in a pair of window reflections
      const y = (r() * 2 - 1) * H, ph = r() * TAU, rad = glassR(y)
      const dy = (glassR(y + 0.01) - glassR(y - 0.01)) / 0.02
      const nn = norm([Math.cos(ph), -dy, Math.sin(ph)])
      const rim = Math.pow(1 - Math.abs(nn[2]), 3)
      const hi = Math.exp(-Math.pow(nn[0] - 0.5, 2) / 0.006) + Math.exp(-Math.pow(nn[0] + 0.5, 2) / 0.006)
      return V([Math.cos(ph) * rad, y, Math.sin(ph) * rad], 2, 0.06 + rim * 0.75 + (nn[2] > 0 ? hi * 0.4 : 0), -1, -1, 0)
    }],
    [15, (r) => { // top and bottom plates: faces, rims and moulded grooves
      const s = r() < 0.5 ? -1 : 1, q = r(), ph = r() * TAU
      if (q < 0.3) { const rad = Math.sqrt(r()) * PR, y = s * (PY + 0.05); return V([Math.cos(ph) * rad, y, Math.sin(ph) * rad], 0, 0.45, -1, -1, 0) }
      if (q < 0.45) { const rad = Math.sqrt(r()) * PR, y = s * (PY - 0.05); return V([Math.cos(ph) * rad, y, Math.sin(ph) * rad], 0, 0.28, -1, -1, 0) }
      if (q < 0.8) { const y = s * (PY + (r() - 0.5) * 0.1); return V([Math.cos(ph) * PR, y, Math.sin(ph) * PR], 0, lit([Math.cos(ph), 0, Math.sin(ph)]) + 0.1, -1, -1, 0) }
      const rad = [PR * 0.78, PR, PR + 0.02, glassR(H) + 0.02][Math.floor(r() * 4)]
      return V([Math.cos(ph) * rad, s * (PY + 0.052), Math.sin(ph) * rad], 1, 0.9, -1, -1, 0)
    }],
    [9, (r) => { // three posts
      const k = Math.floor(r() * 3), a = (k / 3) * TAU + Math.PI / 2, y = (r() * 2 - 1) * PY, ph = r() * TAU, rr = postR(y)
      const nn = [Math.cos(ph), 0, Math.sin(ph)]
      return V([Math.cos(a) * POST + nn[0] * rr, y, Math.sin(a) * POST + nn[2] * rr], 0, lit(nn), -1, -1, 0)
    }],
    [22, (r) => { // the clock face behind: bezel, chapter ring, minute and hour marks, a faint dial
      const q = r(), ph = r() * TAU
      if (q < 0.26) { const rad = r() < 0.6 ? R : R - 0.07; return V([Math.cos(ph) * rad, Math.sin(ph) * rad, Z], 0, rad === R ? 0.62 : 0.38, 0, -1, 50) }
      if (q < 0.36) { const rad = r() < 0.5 ? R * 0.62 : R * 0.12; return V([Math.cos(ph) * rad, Math.sin(ph) * rad, Z], 3, 0.6, 0, -1, 50) }
      if (q < 0.56) { const m = Math.floor(r() * 60), a = (m / 60) * TAU, rad = lerp(R - 0.2, R - 0.12, r()); return V([Math.sin(a) * rad + (r() - 0.5) * 0.008, Math.cos(a) * rad, Z], 2, 0.32, 0, -1, 50) }
      if (q < 0.86) { // hour marks: bold bars, doubled at twelve
        const h = Math.floor(r() * 12), a = (h / 12) * TAU, rad = lerp(R - 0.42, R - 0.13, r()), w = (r() - 0.5) * (h === 0 ? 0.09 : 0.045)
        return V([Math.sin(a) * rad + Math.cos(a) * w, Math.cos(a) * rad - Math.sin(a) * w, Z], 1, h % 3 ? 0.5 : 0.75, 0, -1, 50)
      }
      const rad = Math.sqrt(r()) * (R - 0.08); return V([Math.cos(ph) * rad, Math.sin(ph) * rad, Z - 0.01], 3, 0.12, 0, -1, 50)
    }],
    [8, (r) => { // hands: hour, minute and a slim glowing second hand, and the centre cap
      const q = r()
      if (q < 0.34) { const [x, y, z, e] = hand(r, R * 0.5, 0.06, 0.12); return V([x, y, z], 0, e ? 0.95 : 0.7, 1, -1, 50) }
      if (q < 0.74) { const [x, y, z, e] = hand(r, R * 0.78, 0.042, 0.15); return V([x, y, z + 0.01], 0, e ? 0.95 : 0.75, 2, -1, 50) }
      if (q < 0.93) { const [x, y, z] = hand(r, R * 0.86, 0.008, 0.28); return V([x, y, z + 0.02], 4, 0.9, 3, -1, 50) }
      const a = r() * TAU, rr = Math.sqrt(r()) * 0.05; return V([Math.cos(a) * rr, Math.sin(a) * rr, Z + 0.03], 1, 0.9, 0, -1, 50)
    }],
  ])
}

/* ============================================================================================
   TESSERACT — a hypercube turning through the fourth dimension and projected in perspective,
   so the inner cube swells outward through the faces of the outer one. Each particle carries its
   4D position: xyz in the position, w in a. Edges, glowing vertices and faint faces: part 37
   with b = 0 edge, 1 vertex, 2 face.
   ========================================================================================== */
export function tesseract(n) {
  const S = 0.78
  const vert = (i) => [0, 1, 2, 3].map((d) => ((i >> d) & 1 ? S : -S))
  const out = (v, kind, tint, sh) => [v[0], v[1], v[2], T(tint, sh), v[3], kind, 37]
  return build(n, 541, [
    [64, (r) => { // 32 edges: the eight along w (joining the two cubes) in the second colour
      const e = Math.floor(r() * 32), d = e >> 3, k = e & 7
      const lo = k & ((1 << d) - 1), v0 = lo | ((k >> d) << (d + 1)), a = vert(v0), t = r()
      a[d] = lerp(-S, S, t)
      const j = a.map((x) => x + gauss(r) * 0.008)
      return out(j, 0, d === 3 ? 1 : 0, 0.75 + r() * 0.2)
    }],
    [14, (r) => { const v = vert(Math.floor(r() * 16)), d = randomOnSphere(r), rr = 0.045 * Math.sqrt(r()); return out([v[0] + d[0] * rr, v[1] + d[1] * rr, v[2] + d[2] * rr, v[3]], 1, 4, 0.95) }],
    [22, (r) => { // 24 square faces, very faint
      const pairs = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]], [d1, d2] = pairs[Math.floor(r() * 6)]
      const v = vert(Math.floor(r() * 16)); v[d1] = lerp(-S, S, r()); v[d2] = lerp(-S, S, r())
      return out(v, 2, d1 === 3 || d2 === 3 ? 1 : 0, 0.12 + r() * 0.1)
    }],
  ])
}

/* ============================================================================================
   WORMHOLE — the embedding diagram of a traversable wormhole: two sheets of space, drawn as a
   crisp grid of rings and meridians with bright rims, curving down into a throat and out the
   other side, with light streaming through it on spiralling paths and a glowing throat ring.
   The surface of revolution is r = R0·cosh(y / A). Flow: part 38 (a = phase, b = angle).
   ========================================================================================== */
export const WORM = { R0: 0.36, A: 0.3, RMAX: 1.95 }
WORM.YMAX = WORM.A * Math.acosh(WORM.RMAX / WORM.R0)
export const WORM_VIEW = 0.42
export function wormhole(n) {
  setView(WORM_VIEW, 0, 0)
  const { R0, A, RMAX, YMAX } = WORM, RINGS = 18, MER = 36
  const at = (y, ph) => { const rad = R0 * Math.cosh(y / A); return [Math.cos(ph) * rad, y, Math.sin(ph) * rad] }
  const nrm = (y, ph) => { const dr = (R0 / A) * Math.sinh(y / A); return norm([Math.cos(ph), -dr, Math.sin(ph)]) }
  // rings evenly spaced in radius, so the grid reads as flat space bending into the throat
  const ringY = (k) => A * Math.acosh(lerp(1, RMAX / R0, Math.pow(k / (RINGS - 1), 1.5)))
  const lineSh = (y, ph, base) => clamp(shadeOf(nrm(y, ph)) * 0.5 + base, 0.05, 0.98) * (1 - sstep(0.75, 1, Math.abs(y) / YMAX) * 0.35)
  return build(n, 551, [
    [38, (r) => { // rings, sampled by circumference so the throat isn't crowded
      let k = Math.floor(r() * RINGS)
      for (let t = 0; t < 6 && r() > (0.2 + k / (RINGS - 1)) / 1.2; t++) k = Math.floor(r() * RINGS)
      const y = (r() < 0.5 ? -1 : 1) * ringY(k), ph = r() * TAU
      return V(jit(r, at(y, ph), 0.0035), k % 3 === 0 ? 1 : 0, lineSh(y, ph, k % 3 === 0 ? 0.48 : 0.36), -1, -1, 0)
    }],
    [32, (r) => { // meridians, sampled by radius
      const m = Math.floor(r() * MER), ph = (m / MER) * TAU
      let y = (r() * 2 - 1) * YMAX
      for (let t = 0; t < 6 && r() > (R0 * Math.cosh(y / A)) / RMAX + 0.15; t++) y = (r() * 2 - 1) * YMAX
      return V(jit(r, at(y, ph), 0.0035), 0, lineSh(y, ph, 0.34), -1, -1, 0)
    }],
    [8, (r) => { // bright rims: the outer edge of each sheet, doubled, and the throat
      const q = r(), ph = r() * TAU
      if (q < 0.75) { const y = (r() < 0.5 ? -1 : 1) * (r() < 0.65 ? YMAX : ringY(RINGS - 2)); return V(jit(r, at(y, ph), 0.003), 1, 0.95, -1, -1, 0) }
      return V(jit(r, at(0, ph), 0.004), 4, 0.95, -1, -1, 0)
    }],
    [3, (r) => { const y = (r() * 2 - 1) * YMAX, ph = r() * TAU; return V(at(y, ph), 3, 0.12 + r() * 0.12, -1, -1, 0) }], // the sheet between the lines
    [2, (r) => { const ph = r() * TAU, rad = R0 * (0.15 + 0.85 * Math.sqrt(r())); return V([Math.cos(ph) * rad, gauss(r) * 0.02, Math.sin(ph) * rad], 4, 0.4 + r() * 0.4, -1, -1, 0) }], // the bright throat
    [12, (r) => V([0, 0, 0], r() < 0.2 ? 4 : 1, 0.5 + r() * 0.4, r(), r() * TAU, 38)],
  ])
}

/* ============================================================================================
   TURNTABLE — a record player: a plinth with chamfered edges, a platter with a strobe-dotted
   rim, a spinning record with real groove bands and its label, a spindle, and an S-shaped
   tonearm with counterweight, resting its stylus in the groove; notes drift up from it.
   Record and platter: part 39 (a = radius, b = angle). Notes: part 40 (a = phase, b = note).
   ========================================================================================== */
export const DECK = { c: [-0.38, 0, 0.02], R: 1.02, view: [0.62, -0.38] }
export const NOTE_BASE = [[0.75, 0.2, 0.4], [1.2, 0.05, 0.2], [0.35, 0.3, 0.5]]
export function turntable(n) {
  setView(...DECK.view)
  const { c, R } = DECK, W = 1.45, D = 1.12, Y0 = -0.26
  // groove bands: tracks separated by smooth gaps, fine grooves within
  const TRACKS = [0.36, 0.47, 0.6, 0.7, 0.83, 0.97]
  const inGap = (rad) => TRACKS.some((t) => Math.abs(rad - t) < 0.016)
  const pivot = [1.12, 0.05, -0.78]
  const arm = curve([[1.12, 0.22, -0.78], [0.98, 0.23, -0.35], [0.72, 0.22, 0.02], [0.42, 0.19, 0.3], [0.24, 0.16, 0.38]])
  const note = (r, k) => { // an eighth note (k 0, 2) or a pair of beamed sixteenths (k 1), in its own plane
    const q = r()
    const head = (x0) => { const a = r() * TAU, rr = Math.sqrt(r()); return [x0 + Math.cos(a) * 0.075 * rr, Math.sin(a) * 0.055 * rr - Math.cos(a) * 0.02 * rr, 0] }
    if (k === 1) {
      if (q < 0.4) return head(r() < 0.5 ? 0 : 0.26)
      if (q < 0.7) { const s = r() < 0.5 ? 0 : 0.26; return [s + 0.065, r() * 0.32, 0] }
      const t = r(); return [0.065 + t * 0.26, 0.32 - (r() < 0.5 ? 0 : 0.06) + (r() - 0.5) * 0.03, 0]
    }
    if (q < 0.45) return head(0)
    if (q < 0.75) return [0.065, r() * 0.34, 0]
    const t = r(); return [0.065 + t * 0.12, 0.34 - t * 0.16 - t * t * 0.02 + (r() - 0.5) * 0.02, 0]
  }
  return build(n, 561, [
    [38, (r) => { // the record: grooves catch the light in bands, the label in colour
      const rad = Math.sqrt(lerp(0.0, R * R * 0.93, r())), ph = r() * TAU, p = [c[0] + Math.cos(ph) * rad, 0.1, c[2] + Math.sin(ph) * rad]
      if (rad < 0.06) return V([c[0], 0.1 + r() * 0.12, c[2]], 2, 0.9, rad, ph, 39) // spindle
      if (rad < 0.3) return V(p, rad > 0.285 || (rad > 0.14 && rad < 0.15) ? 2 : 1, 0.6 + r() * 0.3, rad, ph, 39) // label
      if (rad < 0.34 || inGap(rad)) return V(p, 3, 0.2, rad, ph, 39) // run-out and track gaps
      const groove = 0.5 + 0.5 * Math.sin(rad * 170)
      return V(p, groove > 0.45 ? 2 : 3, groove > 0.45 ? 0.35 + groove * 0.4 : 0.22, rad, ph, 39)
    }],
    [8, (r) => { const ph = r() * TAU, y = lerp(-0.02, 0.09, r()), dot = Math.abs(((ph * 60) / TAU) % 1 - 0.5) < 0.18 && y > 0.04; return V([c[0] + Math.cos(ph) * R, y, c[2] + Math.sin(ph) * R], dot ? 2 : 0, dot ? 0.95 : shadeOf([Math.cos(ph), 0, Math.sin(ph)]) * 0.9, R, ph, 39) }], // platter rim with strobe dots
    [18, (r) => { // plinth: chamfered box, top face, front panel and edges
      const q = r()
      if (q < 0.42) { // top face, cut away under the platter
        let x = 0, z = 0
        for (let t = 0; t < 8; t++) { x = (r() * 2 - 1) * W; z = (r() * 2 - 1) * D; if (Math.hypot(x - c[0], z - c[2]) > R + 0.03) break }
        return V([x, 0, z], 0, shadeOf([0, 1, 0]) * 0.55, -1, -1, 0)
      }
      if (q < 0.62) { const x = (r() * 2 - 1) * W, y = lerp(Y0, -0.03, r()); return V([x, y, D + 0.02], 0, shadeOf([0, 0, 1]) * 0.7, -1, -1, 0) } // front
      if (q < 0.72) { const z = (r() * 2 - 1) * D, y = lerp(Y0, -0.03, r()); return V([W + 0.02, y, z], 0, shadeOf([1, 0, 0]) * 0.7, -1, -1, 0) } // side
      const e = Math.floor(r() * 7), t = r() * 2 - 1 // edges
      const E = [[t * W, 0, D], [t * W, 0, -D], [W, 0, t * D], [-W, 0, t * D], [t * W, Y0, D], [W, Y0, t * D], [W, lerp(Y0, 0, (t + 1) / 2), D]][e]
      return V(jit(r, E, 0.004), 0, 0.95, -1, -1, 0)
    }],
    [12, (r) => { // tonearm: pivot, counterweight, S-arm, headshell
      const q = r()
      if (q < 0.2) { const t = tubePt(r, pivot, add(pivot, [0, 0.17, 0]), 0.1, 0.07); return V(t.p, 2, shadeOf(t.n), -1, -1, 0) }
      if (q < 0.38) { const t = tubePt(r, [1.24, 0.23, -1.04], [1.32, 0.23, -1.2], 0.085, 0.085); return V(t.p, 2, shadeOf(t.n) * 0.85, -1, -1, 0) }
      if (q < 0.85) {
        const s = r(), ax = arm(s), [e1, e2] = frame(tangent(arm, s)), a = r() * TAU
        const nn = add(mul(e1, Math.cos(a)), mul(e2, Math.sin(a)))
        return V(add(ax, mul(nn, 0.022)), 2, shadeOf(nn) + 0.15, -1, -1, 0)
      }
      const u = r(), v = r() // headshell: a small angled plate
      return V([0.24 - u * 0.16 + v * 0.03, 0.15 - u * 0.02, 0.38 + u * 0.05 + (v - 0.5) * 0.09], 0, 0.8, -1, -1, 0)
    }],
    [3, (r) => { const k = Math.floor(r() * 2), a = r() * TAU, rr = 0.07 * Math.sqrt(r()); return V([-1.2 + k * 0.24 + Math.cos(a) * rr, 0.02, 0.88 + Math.sin(a) * rr], k ? 2 : 1, 0.85, -1, -1, 0) }], // speed buttons
    [6, (r) => { const k = Math.floor(r() * 3); return V(note(r, k), 1, 0.9, r(), k, 40) }],
  ])
}
