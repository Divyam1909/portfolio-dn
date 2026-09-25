import './style.css'
import Lenis from 'lenis'
import { createAudio } from './audio.js'
import { guessVisitor } from './visitor.js'
import { SKILLS, PROJECTS, LEVELS } from './skills.js'
import {
  toast, initScramble, initMagnetic, initCursor,
  initQuick, openQuick, initPalette,
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
if (!reduced && !/[?&]debug\b/.test(location.search)) {
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

/* ---------- Section sidebar ---------- */
const hud = $('.hud')
hud.querySelectorAll('a').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); goTo(a.getAttribute('href')) }))
// light leaks move to a new composition and flare on every chapter change
const leaks = $('.leaks')
const LEAK_POSES = [
  [[-42, -46], [62, 10], [-30, 55]], [[40, -50], [-40, 30], [55, 60]], [[-50, 10], [60, -30], [10, 70]],
  [[50, 30], [-45, -40], [-20, 65]], [[-40, 45], [55, -35], [20, -60]], [[45, -45], [-50, 40], [60, 55]],
  [[-45, -30], [50, 45], [-10, 70]], [[0, 55], [-55, -45], [60, -40]],
]
let leakTimer = 0
function moveLeaks(i) {
  const pose = LEAK_POSES[i % LEAK_POSES.length]
  leaks.querySelectorAll('.leak').forEach((el, k) => {
    // x in vw-ish, y in vh-ish; pulled partly off-screen so only the bleed shows
    el.style.setProperty('--x', `calc(${pose[k][0]}vw - var(--half) + 50vw)`)
    el.style.setProperty('--y', `calc(${pose[k][1]}vh - var(--half) + 50vh)`)
  })
  if (reduced) return
  leaks.classList.add('is-flash')
  clearTimeout(leakTimer)
  leakTimer = setTimeout(() => leaks.classList.remove('is-flash'), 700)
}

function onShapeChange(i, total, label, section) {
  moveLeaks(i)
  hud.querySelectorAll('a').forEach((a) => {
    const on = a.dataset.section === section
    a.classList.toggle('is-active', on)
    if (on) a.setAttribute('aria-current', 'true')
    else a.removeAttribute('aria-current')
  })
}

/* ---------- Interface ---------- */
initCursor()
initMagnetic()
initScramble()
initQuick()
const audio = createAudio()

// sound toggle
const soundBtn = $('[data-sound]')
async function toggleSound() {
  const on = await audio.toggle()
  soundBtn.setAttribute('aria-pressed', String(on))
  soundBtn.classList.toggle('is-on', on)
  $('[data-sound-state]').textContent = on ? 'on' : 'off'
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

async function boot() {
  if (hasWebGL()) {
    try {
      const { createScene } = await import('./scene.js')
      api = await createScene($('.webgl'), {
        onShapeChange,
        onProgress: (p) => (target = 0.15 + p * 0.85),
        labels: { home: $('[data-label-home]'), visitor: $('[data-label-visitor]'), skill: $('[data-label-skill]'), projects: $$('[data-label-proj]') },
        onPulse: (nx) => audio.pluck(nx),
        onFrame: (s) => audio.update(s),
      })
      api.setVisitor(visitor)
      if (/[?&]debug\b/.test(location.search)) window.__scene = api
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
  const skillName = $('[data-skill-name]')
  const detail = $('[data-skill-detail]')
  const detailEmpty = detail.innerHTML
  skills.forEach((btn, i) => {
    btn.dataset.node = nodeFor(i)
    btn.dataset.cursor = 'Show'
    btn.setAttribute('aria-pressed', 'false')
  })
  const select = (btn) => {
    skills.forEach((b) => {
      b.classList.toggle('is-focus', b === btn)
      b.setAttribute('aria-pressed', String(b === btn))
    })
    if (!btn) { api?.setFocus(null); detail.innerHTML = detailEmpty; return }
    const name = btn.textContent.trim()
    const info = SKILLS[name] || { level: 1, projects: [] }
    api?.setFocus(+btn.dataset.node, info.projects.map((k) => ({ k, s: info.level })))
    skillName.textContent = name
    const bars = [1, 2, 3].map((n) => `<i class="${n <= info.level ? 'on' : ''}"></i>`).join('')
    const used = info.projects.length
      ? `<span>Used in</span>${info.projects.map((k) => `<button type="button" data-goto="${PROJECTS[k].target}">${PROJECTS[k].name}</button>`).join('')}`
      : '<span>Used in coursework and practice projects.</span>'
    detail.innerHTML = `<div class="skill-detail__head"><span class="skill-detail__name">${name}</span>
      <span class="skill-level" data-level="${info.level}"><span class="skill-level__bars" aria-hidden="true">${bars}</span>${LEVELS[info.level]}</span></div>
      <div class="skill-detail__used">${used}</div>`
  }
  skills.forEach((btn) => btn.addEventListener('click', () => select(btn.classList.contains('is-focus') ? null : btn)))
  detail.addEventListener('click', (e) => { const b = e.target.closest('[data-goto]'); if (b) goTo(b.dataset.goto) })

  // Drag to rotate the lattice / globe — follows the pointer, coasts on release
  let dragging = false, lx = 0, ly = 0
  $$('.drag-zone').forEach((zone) => zone.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || e.target.closest('a, button, input')) return
    dragging = true; lx = e.clientX; ly = e.clientY
    api?.dragStart()
    root.classList.add('is-dragging')
  }))
  addEventListener('pointermove', (e) => {
    if (!dragging) return
    // on touch only horizontal swipes rotate, vertical ones keep scrolling the page
    api?.drag(e.clientX - lx, e.pointerType === 'touch' ? 0 : e.clientY - ly)
    lx = e.clientX; ly = e.clientY
  }, { passive: true })
  const stop = () => {
    if (!dragging) return
    dragging = false
    api?.dragEnd()
    root.classList.remove('is-dragging')
  }
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

/* ---------- Command palette ---------- */
initPalette([
  { group: 'Navigate', label: 'Prologue — top', run: () => goTo('#top'), keywords: 'home hero start' },
  { group: 'Navigate', label: 'Chapter 01 · Origin — about me', run: () => goTo('#about'), keywords: 'education cgpa' },
  { group: 'Navigate', label: 'Chapter 02 · Craft — experience', run: () => goTo('#experience'), keywords: 'work internships jobs' },
  { group: 'Navigate', label: 'Chapter 03 · Experiments — projects', run: () => goTo('#projects'), keywords: 'portfolio' },
  { group: 'Navigate', label: 'Internship: ZetaQ', run: () => goTo('[data-shape="3"]'), keywords: 'ai data llm experience' },
  { group: 'Navigate', label: 'Internship: Thinking Engines', run: () => goTo('[data-shape="4"]'), keywords: 'full stack web experience' },
  { group: 'Navigate', label: 'Internship: Arms Robotics', run: () => goTo('[data-shape="5"]'), keywords: 'embedded real-time experience' },
  { group: 'Navigate', label: 'Project: stock market prediction', run: () => goTo('[data-shape="6"]'), keywords: 'ml finance' },
  { group: 'Navigate', label: 'Project: image-to-biomass', run: () => goTo('[data-shape="7"]'), keywords: 'cnn csiro vision' },
  { group: 'Navigate', label: 'Project: EduSage', run: () => goTo('[data-shape="8"]'), keywords: 'education llm gemini' },
  { group: 'Navigate', label: 'Project: Portfolio v1 “Universe”', run: () => goTo('[data-shape="9"]'), keywords: 'old v1 universe solar system history previous' },
  { group: 'Navigate', label: 'Chapter 04 · Toolkit — skills', run: () => goTo('#skills'), keywords: 'tech stack' },
  { group: 'Navigate', label: 'Epilogue — contact', run: () => goTo('#contact'), keywords: 'hire email' },
  { group: 'For recruiters', label: 'Quick view — the 30-second version', run: openQuick, keywords: 'hr summary recruiter tldr' },
  { group: 'For recruiters', label: 'Open résumé (PDF)', run: () => window.open(RESUME, '_blank', 'noopener'), keywords: 'resume cv download' },
  { group: 'For recruiters', label: 'Copy email address', run: copyEmail, keywords: 'contact mail' },
  { group: 'For recruiters', label: 'Send an email', run: () => (location.href = `mailto:${EMAIL}`), keywords: 'contact mail' },
  { group: 'For recruiters', label: 'LinkedIn', run: () => window.open('https://www.linkedin.com/in/divyam-navin', '_blank', 'noopener'), keywords: 'social' },
  { group: 'For recruiters', label: 'GitHub', run: () => window.open('https://github.com/Divyam1909', '_blank', 'noopener'), keywords: 'code social' },
  { group: 'Settings', get label() { return audio.on ? 'Turn sound off' : 'Turn sound on' }, run: toggleSound, keywords: 'audio music' },
])

boot()
