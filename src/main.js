import './style.css'
import Lenis from 'lenis'
import { createAudio } from './audio.js'
import { guessVisitor } from './visitor.js'
import {
  toast, achievements, store, scramble, initScramble, initMagnetic, initCursor,
  initQuick, openQuick, initPalette, isTyping,
} from './ui.js'

const root = document.documentElement
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
const coarse = matchMedia('(pointer: coarse)').matches
const EMAIL = 'divyamnavin@gmail.com'
const RESUME = '/Divyam-Navin-Resume.pdf'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const $ = (s) => document.querySelector(s)
const $$ = (s) => [...document.querySelectorAll(s)]

$$('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()))

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
$$('[data-split]').forEach(splitWords)

/* ---------- Smooth scroll ---------- */
let lenis = null
if (!reduced) {
  lenis = new Lenis({ autoRaf: true, lerp: 0.1, anchors: { offset: -20 }, prevent: (node) => !!node.closest?.('dialog') })
}
function goTo(sel) {
  const el = typeof sel === 'string' ? $(sel) : sel
  if (!el) return
  if (lenis) lenis.scrollTo(el, { offset: -20, duration: 2.2 })
  else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' })
}
$$('dialog').forEach((d) => new MutationObserver(() => (d.open ? lenis?.stop() : lenis?.start())).observe(d, { attributes: true, attributeFilter: ['open'] }))

/* ---------- Nav ---------- */
const nav = $('.nav')
const toggle = $('.nav__toggle')
const setMenu = (open) => {
  nav.classList.toggle('is-open', open)
  toggle.setAttribute('aria-expanded', String(open))
  document.body.style.overflow = open ? 'hidden' : ''
  open ? lenis?.stop() : lenis?.start()
}
toggle.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')))
nav.querySelectorAll('.nav__links a, .nav__links button').forEach((a) => a.addEventListener('click', () => setMenu(false)))
addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); toggle.focus() } })

const progress = $('[data-progress]')
const onScroll = () => {
  const y = scrollY
  nav.classList.toggle('is-scrolled', y > 40)
  const max = root.scrollHeight - innerHeight
  progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`
}
addEventListener('scroll', onScroll, { passive: true })
onScroll()

const links = new Map($$('.nav__links a[href^="#"]').map((a) => [a.getAttribute('href').slice(1), a]))
const sectionIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return
    links.forEach((a) => a.classList.remove('is-active'))
    links.get(e.target.id)?.classList.add('is-active')
  })
}, { rootMargin: '-45% 0px -50% 0px' })
$$('main section[id]').forEach((s) => sectionIO.observe(s))

/* ---------- Reveal on scroll (+ counting stats) ---------- */
function countUp(el) {
  const to = parseFloat(el.dataset.count)
  const decimals = (el.dataset.count.split('.')[1] || '').length
  const t0 = performance.now()
  const step = (now) => {
    const x = Math.min(1, (now - t0) / 1400)
    el.textContent = (to * (1 - Math.pow(1 - x, 3))).toFixed(decimals)
    if (x < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}
let revealed = false
function startReveals() {
  if (revealed) return
  revealed = true
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return
      e.target.classList.add('is-in')
      io.unobserve(e.target)
      if (!reduced) e.target.querySelectorAll?.('[data-count]').forEach(countUp)
    })
  }, { rootMargin: '0px 0px -4% 0px', threshold: 0 })
  $$('[data-reveal], [data-split]').forEach((el) => io.observe(el))
}

/* ---------- HUD ---------- */
const hud = $('.hud')
const pad = (n) => String(n).padStart(2, '0')
function onShapeChange(i, total, label, chapter) {
  $('[data-hud-index]').textContent = pad(i + 1)
  $('[data-hud-total]').textContent = pad(total)
  const ch = $('[data-hud-chapter]')
  const lb = $('[data-hud-label]')
  ch.dataset.text = ch.textContent = chapter
  lb.dataset.text = lb.textContent = label
  scramble(lb)
}

/* ---------- Interface ---------- */
initCursor()
initMagnetic()
initScramble()
initQuick()
const audio = createAudio()
achievements.onUnlock(() => audio.chime())

// sound toggle
const soundBtn = $('[data-sound]')
async function toggleSound() {
  const on = await audio.toggle()
  soundBtn.setAttribute('aria-pressed', String(on))
  soundBtn.classList.toggle('is-on', on)
  $('[data-sound-state]').textContent = on ? 'on' : 'off'
  if (on) achievements.unlock('listener')
}
soundBtn.addEventListener('click', toggleSound)

// copy email
async function copyEmail() {
  try {
    await navigator.clipboard.writeText(EMAIL)
    toast(`Copied <b>${EMAIL}</b> to your clipboard`)
  } catch {
    toast(`Email: <b>${EMAIL}</b>`)
  }
}
$$('[data-copy-email]').forEach((b) => b.addEventListener('click', copyEmail))

// local time in Thane
const timeEl = $('[data-local-time]')
const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
const tickTime = () => (timeEl.textContent = fmt.format(new Date()))
tickTime()
setInterval(tickTime, 20000)

// visitor, roughly, from the time zone
const visitor = guessVisitor()
if (visitor) {
  const inIndia = /Delhi/.test(visitor.city)
  $('[data-visitor-city]').textContent = inIndia ? 'You · India' : `You · ~${visitor.city}`
  const R = 6371, rad = Math.PI / 180
  const dLat = (visitor.lat - 19.2) * rad, dLon = (visitor.lon - 72.97) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(19.2 * rad) * Math.cos(visitor.lat * rad) * Math.sin(dLon / 2) ** 2
  const km = Math.round((2 * R * Math.asin(Math.sqrt(h))) / 100) * 100
  $('[data-visitor-line]').textContent = inIndia ? 'you’re in India too — let’s talk' : `your signal is ~${km.toLocaleString()} km away`
}

/* ---------- Loader + 3D ---------- */
const countEl = $('[data-loader-count]')
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

async function typeHello() {
  const el = $('[data-hello]')
  const text = 'Hello, I’m Divyam.'
  for (let i = 1; i <= text.length; i++) {
    el.textContent = text.slice(0, i)
    await wait(55)
  }
}

let api = null
let pulses = 0
let explored = false

async function boot() {
  if (hasWebGL()) {
    try {
      const { createScene } = await import('./scene.js')
      api = await createScene($('.webgl'), {
        onShapeChange,
        onProgress: (p) => (target = 0.15 + p * 0.85),
        labels: { home: $('[data-label-home]'), visitor: $('[data-label-visitor]'), skill: $('[data-label-skill]') },
        onPulse: (nx) => {
          audio.pluck(nx)
          if (++pulses === 12) achievements.unlock('disturber')
        },
        onFrame: (s) => {
          audio.update(s)
          if (!explored && s.morph > 6.95) { explored = true; achievements.unlock('explorer') }
        },
      })
      api.setVisitor(visitor)
      hud.classList.add('is-visible')
    } catch (err) {
      console.warn('3D scene disabled:', err)
      root.classList.add('no-webgl')
    }
  } else {
    root.classList.add('no-webgl')
  }
  target = 1
  await wait(reduced ? 0 : 380)
  if (api && !reduced) {
    root.classList.add('is-intro')
    typeHello()
    await api.playIntro()
    await wait(200)
  }
  root.classList.add('is-loaded')
  setTimeout(startReveals, reduced ? 0 : 150)
  initInteractions()
}

// Safety net: never let the loader trap content
setTimeout(() => {
  if (!root.classList.contains('is-loaded')) { root.classList.add('is-loaded'); startReveals() }
}, 9000)

/* ---------- Interactions that need the 3D scene ---------- */
function initInteractions() {
  // Skill constellation
  const skills = $$('[data-skill]')
  const nodeFor = (i) => (i * 29 + 7) % 64
  const seen = new Set()
  const skillName = $('[data-skill-name]')
  skills.forEach((btn, i) => {
    btn.dataset.node = nodeFor(i)
    btn.dataset.cursor = 'Locate'
  })
  const focus = (btn) => {
    skills.forEach((b) => b.classList.toggle('is-focus', b === btn))
    if (!btn) { api?.setFocus(null); return }
    const group = [...btn.closest('.skill-group').querySelectorAll('[data-skill]')].map((b) => +b.dataset.node)
    api?.setFocus(+btn.dataset.node, group)
    skillName.textContent = btn.textContent
    seen.add(btn.textContent)
    if (seen.size === 5) achievements.unlock('cartographer')
  }
  skills.forEach((btn) => {
    btn.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && focus(btn))
    btn.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && focus(null))
    btn.addEventListener('focus', () => focus(btn))
    btn.addEventListener('blur', () => focus(null))
    btn.addEventListener('click', () => focus(btn))
  })

  // Drag to spin the lattice / globe
  let dragging = false, lx = 0
  $$('.drag-zone').forEach((zone) => zone.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a, button, input')) return
    dragging = true; lx = e.clientX
  }))
  addEventListener('pointermove', (e) => { if (!dragging) return; api?.addSpin(e.clientX - lx); lx = e.clientX }, { passive: true })
  const stop = () => (dragging = false)
  addEventListener('pointerup', stop)
  addEventListener('pointercancel', stop)

  // Gyroscope tilt on phones (iOS asks permission on the first tap)
  if (coarse && api) {
    const listen = () => addEventListener('deviceorientation', (e) => {
      if (e.gamma == null) return
      api.setGyro(e.gamma / 25, -(e.beta - 50) / 25)
    })
    addEventListener('touchend', () => {
      const DO = window.DeviceOrientationEvent
      if (DO && typeof DO.requestPermission === 'function') DO.requestPermission().then((s) => s === 'granted' && listen()).catch(() => {})
      else listen()
    }, { once: true })
  }
}

/* ---------- Easter eggs ---------- */
function sayHello() {
  if (!api) { toast('✦ hello to you too'); return }
  api.sayHello()
  toast('✦ <b>hello</b> to you too')
  achievements.unlock('hello')
}
const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a']
let keys = []
addEventListener('keydown', (e) => {
  if (isTyping(e.target) || e.metaKey || e.ctrlKey) return
  keys = [...keys, e.key.toLowerCase()].slice(-10)
  if (KONAMI.every((k, i) => keys[i] === k)) { keys = []; sayHello() }
  else if (keys.slice(-5).join('') === 'hello') { keys = []; sayHello() }
})

/* ---------- Mini-game: catch the signal ---------- */
const gameBox = $('.game')
function startGame() {
  if (!api) { toast('The game needs WebGL — try another browser.'); return }
  gameBox.hidden = false
  api.startGame(({ score, left, over }) => {
    $('[data-game-score]').textContent = score
    $('[data-game-time]').textContent = Math.ceil(left)
    if (over) {
      gameBox.hidden = true
      const best = Math.max(score, store.get('dn-best', 0))
      store.set('dn-best', best)
      toast(`Round over — you caught <b>${score}</b> signal${score === 1 ? '' : 's'}. Best: ${best}`, { ms: 4200 })
      if (score >= 10) achievements.unlock('catcher')
    }
  })
  toast(coarse ? 'Tap the glowing signal as many times as you can in 20s' : 'Click the glowing signal as many times as you can in 20s')
}

function showAchievements() {
  const items = achievements.list().map((a) => `<li class="${a.done ? 'done' : ''}">${a.done ? '✦' : '○'} ${a.done ? a.text : a.text.split(' — ')[0] + ' — ???'}</li>`).join('')
  toast(`<b>Achievements ${achievements.count}/${achievements.total}</b><ul class="toast__list">${items}</ul>`, { ms: 7000 })
}

/* ---------- Command palette ---------- */
initPalette([
  { group: 'Navigate', label: 'Prologue — top', run: () => goTo('#top'), keywords: 'home hero start' },
  { group: 'Navigate', label: 'Chapter 01 · Origin — about me', run: () => goTo('#about'), keywords: 'education cgpa' },
  { group: 'Navigate', label: 'Chapter 02 · Craft — experience', run: () => goTo('#experience'), keywords: 'work internships jobs' },
  { group: 'Navigate', label: 'Chapter 03 · Experiments — projects', run: () => goTo('#projects'), keywords: 'portfolio' },
  { group: 'Navigate', label: 'Project: stock market prediction', run: () => goTo('[data-shape="3"]'), keywords: 'ml finance' },
  { group: 'Navigate', label: 'Project: image-to-biomass', run: () => goTo('[data-shape="4"]'), keywords: 'cnn csiro vision' },
  { group: 'Navigate', label: 'Project: EduSage', run: () => goTo('[data-shape="5"]'), keywords: 'education llm gemini' },
  { group: 'Navigate', label: 'Chapter 04 · Toolkit — skills', run: () => goTo('#skills'), keywords: 'tech stack' },
  { group: 'Navigate', label: 'Epilogue — contact', run: () => goTo('#contact'), keywords: 'hire email' },
  { group: 'For recruiters', label: 'Quick view — the 30-second version', run: openQuick, keywords: 'hr summary recruiter tldr' },
  { group: 'For recruiters', label: 'Open résumé (PDF)', run: () => window.open(RESUME, '_blank', 'noopener'), keywords: 'resume cv download' },
  { group: 'For recruiters', label: 'Copy email address', run: copyEmail, keywords: 'contact mail' },
  { group: 'For recruiters', label: 'Send an email', run: () => (location.href = `mailto:${EMAIL}`), keywords: 'contact mail' },
  { group: 'For recruiters', label: 'LinkedIn', run: () => window.open('https://www.linkedin.com/in/divyam-navin', '_blank', 'noopener'), keywords: 'social' },
  { group: 'For recruiters', label: 'GitHub', run: () => window.open('https://github.com/Divyam1909', '_blank', 'noopener'), keywords: 'code social' },
  { group: 'Play', get label() { return audio.on ? 'Turn sound off' : 'Turn sound on' }, run: toggleSound, keywords: 'audio music' },
  { group: 'Play', label: 'Catch the signal — 20-second game', run: startGame, keywords: 'game play fun' },
  { group: 'Play', label: 'Show achievements', run: showAchievements, keywords: 'trophies secrets' },
  { group: 'Secret', label: 'Say hello ✦', secret: ['hello', 'secret', 'hi there'], run: sayHello },
])

boot()
