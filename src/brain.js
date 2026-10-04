// A human brain, left side three-quarter view (front is +z, the left hemisphere +x). Two cerebral
// hemispheres split by the longitudinal fissure, frontal, temporal and occipital lobes, the
// cerebellum tucked under the back with its fine parallel folia, and the brainstem. The cortex is
// folded into gyri and sulci, a domain-warped gyroid whose grooves are drawn as bright lines, and
// the landmark fissures are traced over it: the lateral (Sylvian) fissure above the temporal
// lobe, the central sulcus, the parieto-occipital sulcus and the preoccipital notch.
//
// Cortex and cerebellum: part 24 with a = gyrus crest (0 sulcus … 1 crest), for the waves of
// activity. Firing neurons: part 25 with a = phase.

import { gauss, randomOnSphere } from './shapes.js'
import { lerp, sstep, add, mul, fbm, noise, setView, shadeOf, T, makeSculpt, build, curve } from './fauna.js'

const SCALE = 1.08
export const BRAIN_VIEW = [0.12, 1.25] // rest pose: rotY(rotX(p, x), y), a near side profile facing right

export function brain(n) {
  setView(...BRAIN_VIEW)
  const prims = []
  for (const side of [1, -1]) {
    const x = (v) => v * side
    prims.push(
      { e: [[x(0.47), 0.22, 0.02], [0.47, 0.66, 1.08]], tag: 'cortex', k: 0.03 }, // hemisphere
      { e: [[x(0.44), 0.08, 0.62], [0.42, 0.52, 0.5]], tag: 'cortex', k: 0.12 }, // frontal pole
      { e: [[x(0.6), -0.3, 0.2], [0.34, 0.3, 0.62]], tag: 'cortex', k: 0.14 }, // temporal lobe
      { e: [[x(0.42), 0.04, -0.76], [0.4, 0.5, 0.4]], tag: 'cortex', k: 0.12 }, // occipital lobe
      { e: [[x(0.3), -0.56, -0.68], [0.32, 0.26, 0.34]], tag: 'cerebellum', k: 0.08 },
    )
  }
  prims.push(
    { c: [[0, -0.42, -0.24], [0, -1.18, -0.38], 0.19, 0.13], tag: 'stem', k: 0.1 }, // brainstem
    { e: [[0, -0.5, -0.2], [0.22, 0.14, 0.2]], tag: 'stem', k: 0.1 }, // pons
  )
  const body = makeSculpt(prims, 0.1)

  // gyri: a domain-warped gyroid, whose zero set winds over any surface like a maze; the sulci
  // are the narrow grooves along it and the crests the rounded ridges between them
  const folds = (p) => {
    const w = noise(mul(p, 1.8)) * 2.4
    const x = p[0] * 7.4 + w, y = p[1] * 7.4 - w, z = p[2] * 7.4 + w * 0.5
    return sstep(0.06, 0.42, Math.abs(Math.sin(x) * Math.cos(y) + Math.sin(y) * Math.cos(z) + Math.sin(z) * Math.cos(x)) / 1.5)
  }
  const out = (p) => mul(p, SCALE)

  // a point on the brain: its fold value (0 deep in a sulcus … 1 on a gyrus crest), sunk into the
  // sulci, with its shade
  const point = (r) => {
    const { p, n: nn, tag, ao } = body.sample(r)
    const sh = shadeOf(nn) * lerp(0.4, 1, ao)
    if (tag === 'stem') return { p, sh, crest: 1, tag }
    const crest = tag === 'cerebellum'
      ? sstep(0.05, 0.5, Math.abs(Math.sin((p[1] * 1.4 - p[2] * 0.6) * 30 + fbm(mul(p, 3)) * 4))) // folia
      : folds(p)
    return { p: add(p, mul(nn, -(1 - crest) * 0.06)), sh, crest, tag }
  }
  const fissure = (p) => Math.abs(p[0]) < 0.06 // the dark gap between the hemispheres
  // the major fissures, traced on each hemisphere's outer surface: [points (x for the left side), weight]
  const LANDMARKS = [
    [[[0.62, -0.18, 0.62], [0.78, -0.08, 0.3], [0.86, 0.02, 0.0], [0.84, 0.12, -0.3], [0.74, 0.3, -0.5]], 1.4], // lateral fissure
    [[[0.12, 0.86, -0.02], [0.4, 0.74, 0.08], [0.66, 0.5, 0.2], [0.84, 0.2, 0.3]], 1], // central sulcus
    [[[0.1, 0.62, -0.72], [0.32, 0.5, -0.8], [0.5, 0.34, -0.84]], 0.6], // parieto-occipital sulcus
    [[[0.66, -0.36, -0.42], [0.78, -0.2, -0.56], [0.74, -0.02, -0.72]], 0.5], // preoccipital notch
    [[[0.38, 0.62, 0.66], [0.58, 0.38, 0.72], [0.66, 0.1, 0.72]], 0.6], // inferior frontal sulcus
  ].flatMap(([pts, w]) => [1, -1].map((s) => ({ c: curve(pts.map(([x, y, z]) => body.project([x * s, y, z]))), w })))
  const lmW = LANDMARKS.map((l) => l.w), lmT = lmW.reduce((a, b) => a + b, 0)

  // As with the heart's vessels, lines carry the form in particles: the sulci are drawn as dense,
  // bright grooves over the dimmer, rounded gyri.
  return build(n, 491, [
    [44, (r) => { // the cortex surface, mostly gyri
      const { p, sh, crest, tag } = point(r)
      if (tag === 'stem') return [...out(p), T(0, sh * 0.8), 0.6, -1, 24]
      if (fissure(p)) return [...out(p), T(5, sh), crest, -1, 24]
      return [...out(p), T(3, sh * lerp(0.62, 1, crest)), crest, -1, 24]
    }],
    [38, (r) => { // the sulci
      let q = point(r)
      for (let k = 0; k < 12 && (q.crest > 0.3 || q.tag === 'stem' || fissure(q.p)); k++) q = point(r)
      return [...out(q.p), T(0, Math.min(0.98, 0.3 + q.sh * 0.8)), q.crest, -1, 24]
    }],
    [7, (r) => { // the major fissures: deep, bright and a little wider than the other sulci
      let x = r() * lmT, k = 0
      while (x > lmW[k] && k < lmW.length - 1) x -= lmW[k++]
      const c = LANDMARKS[k].c(r()), nn = body.grad(c), d = mul(randomOnSphere(r), 0.012)
      return [...out(add(add(c, mul(nn, -0.05)), d)), T(0, Math.min(0.98, 0.45 + shadeOf(nn) * 0.6)), 0, -1, 24]
    }],
    [4, (r) => { // neurons firing: sparks just above the cortex
      const { p, n: nn } = body.sample(r)
      return [...out(add(p, mul(nn, 0.02 + Math.abs(gauss(r)) * 0.02))), T(4, 0.9), r(), -1, 25]
    }],
  ])
}

// back and front of the brain along z, for the wave of activity the shader sweeps across it
export const BRAIN_Z = [-0.9 * SCALE, 1.1 * SCALE]
