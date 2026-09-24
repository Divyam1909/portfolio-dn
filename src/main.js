import './style.css'
import Lenis from 'lenis'

const root = document.documentElement
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()))

/* ---------- Split headings into masked words (keeps inline markup like <em>) ---------- */
function splitWords(el) {
  let i = 0
  const walk = (node) => {
    ;[...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment()
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return
          if (/^\s+$/.test(part)) return frag.append(part)
          const w = document.createElement('span')
          w.className = 'w'
          const inner = document.createElement('span')
          inner.textContent = part
          inner.style.setProperty('--i', i++)
          w.append(inner)
          frag.append(w)
        })
        child.replaceWith(frag)
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child)
      }
    })
  }
  walk(el)
}
document.querySelectorAll('[data-split]').forEach(splitWords)

/* ---------- Smooth scroll ---------- */
let lenis = null
if (!reduced) {
  lenis = new Lenis({ autoRaf: true, lerp: 0.1, anchors: { offset: -20 } })
}

/* ---------- Nav ---------- */
const nav = document.querySelector('.nav')
const toggle = document.querySelector('.nav__toggle')
const setMenu = (open) => {
  nav.classList.toggle('is-open', open)
  toggle.setAttribute('aria-expanded', String(open))
  document.body.style.overflow = open ? 'hidden' : ''
  open ? lenis?.stop() : lenis?.start()
}
toggle.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')))
nav.querySelectorAll('.nav__links a').forEach((a) => a.addEventListener('click', () => setMenu(false)))
addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); toggle.focus() } })

const progress = document.querySelector('[data-progress]')
const onScroll = () => {
  const y = scrollY
  nav.classList.toggle('is-scrolled', y > 40)
  const max = document.documentElement.scrollHeight - innerHeight
  progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`
}
addEventListener('scroll', onScroll, { passive: true })
onScroll()

const links = new Map([...document.querySelectorAll('.nav__links a[href^="#"]')].map((a) => [a.getAttribute('href').slice(1), a]))
const sectionIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return
    links.forEach((a) => a.classList.remove('is-active'))
    links.get(e.target.id)?.classList.add('is-active')
  })
}, { rootMargin: '-45% 0px -50% 0px' })
document.querySelectorAll('main section[id]').forEach((s) => sectionIO.observe(s))

/* ---------- Reveal on scroll ---------- */
let revealed = false
function startReveals() {
  if (revealed) return
  revealed = true
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target) }
    })
  }, { rootMargin: '0px 0px -4% 0px', threshold: 0 })
  document.querySelectorAll('[data-reveal], [data-split]').forEach((el) => io.observe(el))
}

/* ---------- HUD ---------- */
const hud = document.querySelector('.hud')
const hudIndex = document.querySelector('[data-hud-index]')
const hudTotal = document.querySelector('[data-hud-total]')
const hudLabel = document.querySelector('[data-hud-label]')
const pad = (n) => String(n).padStart(2, '0')
function onShapeChange(i, total, label) {
  hudIndex.textContent = pad(i + 1)
  hudTotal.textContent = pad(total)
  hudLabel.textContent = label
}

/* ---------- Loader + WebGL ---------- */
const countEl = document.querySelector('[data-loader-count]')
let shown = 0, target = 0.15
const tick = () => {
  shown += (target - shown) * 0.12
  countEl.textContent = Math.min(100, Math.round(shown * 100))
  if (shown < 0.995) requestAnimationFrame(tick)
}
requestAnimationFrame(tick)

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch { return false }
}

async function boot() {
  const started = performance.now()
  if (hasWebGL()) {
    try {
      const { createScene } = await import('./scene.js')
      await createScene(document.querySelector('.webgl'), {
        onShapeChange,
        onProgress: (p) => (target = 0.15 + p * 0.85),
      })
      hud.classList.add('is-visible')
    } catch (err) {
      console.warn('3D scene disabled:', err)
      root.classList.add('no-webgl')
    }
  } else {
    root.classList.add('no-webgl')
  }
  target = 1
  // keep the intro on screen just long enough to read, never longer than needed
  const wait = Math.max(0, (reduced ? 200 : 900) - (performance.now() - started))
  setTimeout(() => {
    root.classList.add('is-loaded')
    setTimeout(startReveals, reduced ? 0 : 350)
  }, wait)
}

// Safety net: never let the loader trap content
setTimeout(() => {
  if (!root.classList.contains('is-loaded')) { root.classList.add('is-loaded'); startReveals() }
}, 6000)

boot()
