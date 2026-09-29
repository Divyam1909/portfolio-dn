// Builds the intro forms off the main thread; the heavier sculpts take a few hundred ms each.
import { HERO_SHAPES } from './hero.js'

self.onmessage = ({ data: { k, n } }) => {
  const s = HERO_SHAPES[k](n)
  self.postMessage({ k, pos: s.pos, order: s.order }, [s.pos.buffer, s.order.buffer])
}
