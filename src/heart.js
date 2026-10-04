// An anatomical human heart, anterior view (the patient's left is +x, so the apex points down and
// to the right of the screen). Ventricles, both atria and auricles, the aortic arch with its three
// branches, the pulmonary trunk splitting under the arch, the venae cavae and pulmonary veins, and
// coronary vessels running in pale fat along the grooves. Textbook colours: arteries and muscle
// red, deoxygenated vessels blue.
//
// Every particle: part 20, a = region (0 ventricles, 1 atria, 2 great vessels) for the heartbeat.

import { gauss } from './shapes.js'
import { TAU, lerp, sub, add, mul, len, norm, fbm, setView, shadeOf, T, makeSculpt, build } from './fauna.js'
import { curve } from './fauna.js'

const SCALE = 1.25, SHIFT = -0.1
export const HEART_CENTRES = { ventricles: [0.2, -0.5, 0], atria: [-0.25, 0.37, -0.19] } // after SHIFT and SCALE

export function heart(n) {
  setView(0.05, 0.1)
  const tube = (pts, r0, r1, tag, segs = 8, k = 0.04) => {
    const c = curve(pts), out = []
    for (let s = 0; s < segs; s++) out.push({ c: [c(s / segs), c((s + 1) / segs), lerp(r0, r1, s / segs), lerp(r0, r1, (s + 1) / segs)], tag, k })
    return out
  }
  const prims = [
    { c: [[0.08, 0.02, -0.08], [0.52, -1.0, 0.05], 0.6, 0.1], tag: 'lv', k: 0.2 },
    { e: [[-0.18, -0.2, 0.18], [0.5, 0.52, 0.36]], tag: 'rv', k: 0.2 },
    { c: [[-0.25, 0.05, 0.2], [0.3, -0.75, 0.2], 0.42, 0.12], tag: 'rv', k: 0.2 },
    { e: [[-0.62, 0.25, 0.0], [0.3, 0.36, 0.3]], tag: 'ra', k: 0.12 },
    { e: [[-0.4, 0.5, 0.28], [0.18, 0.1, 0.12]], tag: 'ra', k: 0.06 }, // right auricle
    { e: [[0.2, 0.42, -0.32], [0.36, 0.22, 0.26]], tag: 'la', k: 0.12 },
    { e: [[0.5, 0.38, 0.12], [0.16, 0.08, 0.11]], tag: 'la', k: 0.05 }, // left auricle
    { e: [[-0.18, 0.34, 0.02], [0.19, 0.15, 0.19]], tag: 'aorta', k: 0.06 }, // aortic root
    ...tube([[-0.18, 0.3, 0.02], [-0.24, 0.6, 0.06], [-0.16, 0.86, 0.0], [0.08, 0.98, -0.14], [0.34, 0.9, -0.3], [0.44, 0.66, -0.4], [0.46, 0.3, -0.46]], 0.15, 0.13, 'aorta', 12),
    ...tube([[-0.1, 0.94, -0.06], [-0.16, 1.1, -0.04], [-0.22, 1.26, -0.02]], 0.07, 0.058, 'aorta', 3, 0.03), // brachiocephalic
    ...tube([[0.08, 0.99, -0.14], [0.09, 1.14, -0.13], [0.1, 1.3, -0.12]], 0.052, 0.046, 'aorta', 3, 0.03), // left common carotid
    ...tube([[0.26, 0.95, -0.24], [0.32, 1.1, -0.24], [0.4, 1.25, -0.24]], 0.056, 0.048, 'aorta', 3, 0.03), // left subclavian
    ...tube([[0.02, 0.16, 0.44], [0.14, 0.46, 0.34], [0.22, 0.66, 0.1]], 0.15, 0.13, 'pa', 6, 0.05), // pulmonary trunk
    ...tube([[0.22, 0.66, 0.1], [0.44, 0.7, 0.0], [0.66, 0.64, -0.08]], 0.1, 0.085, 'pa', 4, 0.03), // left pulmonary artery
    ...tube([[0.22, 0.66, 0.1], [-0.2, 0.7, -0.16], [-0.62, 0.66, -0.2]], 0.1, 0.085, 'pa', 5, 0.03), // right PA, under the arch
    ...tube([[-0.58, 0.42, -0.04], [-0.56, 0.72, -0.06], [-0.52, 1.06, -0.08]], 0.115, 0.11, 'vc', 5, 0.04), // superior vena cava
    ...tube([[-0.56, -0.05, -0.2], [-0.54, -0.3, -0.24], [-0.52, -0.52, -0.26]], 0.1, 0.1, 'vc', 3, 0.04), // inferior vena cava
    ...tube([[0.42, 0.46, -0.42], [0.62, 0.52, -0.46], [0.84, 0.56, -0.48]], 0.065, 0.055, 'pv', 3, 0.03),
    ...tube([[0.42, 0.34, -0.46], [0.62, 0.28, -0.5], [0.82, 0.22, -0.52]], 0.065, 0.055, 'pv', 3, 0.03),
    ...tube([[-0.1, 0.44, -0.5], [-0.3, 0.5, -0.56], [-0.46, 0.54, -0.6]], 0.06, 0.05, 'pv', 3, 0.03),
  ]
  const body = makeSculpt(prims, 0.1)

  // coronary vessels on the surface: [points, colour tint (0 artery / 1 vein), radius]
  const vessels = [
    [[[0.02, 0.28, 0.5], [0.12, -0.1, 0.62], [0.28, -0.5, 0.5], [0.45, -0.88, 0.2]], 0, 0.016], // LAD
    [[[0.06, 0.26, 0.5], [0.16, -0.12, 0.64], [0.3, -0.52, 0.5], [0.46, -0.86, 0.24]], 1, 0.012], // great cardiac vein
    [[[0.14, -0.08, 0.6], [0.34, -0.24, 0.5], [0.52, -0.36, 0.3]], 0, 0.01], // diagonal
    [[[0.2, -0.36, 0.56], [0.38, -0.56, 0.4], [0.5, -0.66, 0.2]], 0, 0.009], // diagonal
    [[[-0.12, 0.28, 0.42], [-0.4, 0.12, 0.42], [-0.62, -0.12, 0.26], [-0.66, -0.38, 0.0]], 0, 0.015], // right coronary
    [[[-0.34, 0.08, 0.46], [-0.3, -0.3, 0.52], [-0.18, -0.62, 0.4]], 0, 0.009], // right marginal
    [[[0.12, 0.28, 0.42], [0.46, 0.18, 0.3], [0.66, -0.02, 0.0]], 0, 0.013], // circumflex
    [[[0.52, 0.12, 0.3], [0.66, -0.26, 0.22], [0.66, -0.6, 0.1]], 1, 0.01], // left marginal vein
  ].map(([pts, tint, rad]) => ({ c: curve(pts.map((p) => body.project(p))), tint, rad }))
  const nearVessel = (p) => {
    let d = 9
    for (const v of vessels) for (let s = 0; s <= 24; s++) d = Math.min(d, len(sub(v.c(s / 24), p)))
    return d
  }
  const region = (tag) => (tag === 'lv' || tag === 'rv' ? 0 : tag === 'ra' || tag === 'la' ? 1 : 2)
  const out = (p) => [p[0] * SCALE, (p[1] + SHIFT) * SCALE, p[2] * SCALE]

  return build(n, 471, [
    [84, (r) => {
      const { p, n: nn, tag, ao } = body.sample(r)
      const sh = shadeOf(nn) * lerp(0.3, 1, ao)
      const grain = fbm([p[0] * 7, p[1] * 7, p[2] * 7])
      let tint = 0, s = sh * (0.8 + grain * 0.35)
      if (tag === 'pa' || tag === 'vc') tint = 1
      else if (tag === 'pv') tint = 3
      else if (tag === 'aorta') s = Math.min(0.98, sh * 1.1)
      else if (tag === 'ra' || tag === 'la') s *= 0.85
      if (region(tag) === 0 && nearVessel(p) < 0.05 + grain * 0.03) tint = 2 // epicardial fat in the grooves
      return [...out(p), T(tint, s), region(tag), -1, 20]
    }],
    [10, (r) => { // coronary arteries and veins
      const v = vessels[Math.floor(r() * vessels.length)], t = r()
      const c = v.c(t), a = r() * TAU, d = norm([Math.cos(a), Math.sin(a), gauss(r) * 0.3])
      const p = add(c, mul(d, v.rad * (0.6 + r() * 0.5)))
      const nn = body.grad(c)
      return [...out(add(p, mul(nn, v.rad))), T(v.tint, Math.min(0.98, shadeOf(nn) * 1.2)), 0, -1, 20]
    }],
  ])
}
