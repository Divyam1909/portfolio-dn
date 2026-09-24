// Interface layer: custom cursor, magnetic elements, text scramble, toasts,
// achievements, the ⌘K command palette and the recruiter quick view.

const fine = matchMedia('(pointer: fine)').matches
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/* ---------- Toasts ---------- */
const toastBox = document.querySelector('.toasts')
export function toast(message, { accent = false, ms = 3200 } = {}) {
  const el = document.createElement('div')
  el.className = 'toast' + (accent ? ' toast--accent' : '')
  el.innerHTML = message
  toastBox.append(el)
  requestAnimationFrame(() => el.classList.add('is-in'))
  setTimeout(() => {
    el.classList.remove('is-in')
    setTimeout(() => el.remove(), 500)
  }, ms)
}

/* ---------- Achievements ---------- */
const ACH = {
  explorer: 'Explorer — reached the end of the journey',
  disturber: 'Disturbance — sent 12 shockwaves',
  hello: 'Signal found — discovered the hidden message',
  catcher: 'Signal catcher — caught 10 in one round',
  skim: 'Speed reader — opened the quick view',
  listener: 'Listener — turned the sound on',
  cartographer: 'Cartographer — explored 5 skills',
}
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private mode */ } },
}
const unlocked = new Set(store.get('dn-ach', []))
let onUnlock = () => {}
export const achievements = {
  total: Object.keys(ACH).length,
  get count() { return unlocked.size },
  list() { return Object.entries(ACH).map(([id, text]) => ({ id, text, done: unlocked.has(id) })) },
  unlock(id) {
    if (!ACH[id] || unlocked.has(id)) return
    unlocked.add(id)
    store.set('dn-ach', [...unlocked])
    toast(`<b>Achievement unlocked</b> ${ACH[id]} <span class="toast__meta">${unlocked.size}/${this.total}</span>`, { accent: true, ms: 4200 })
    onUnlock(id)
  },
  onUnlock(fn) { onUnlock = fn },
}
export { store }

/* ---------- Text scramble ---------- */
const GLYPHS = '!<>-_\\/[]{}—=+*^?#01'
export function scramble(el) {
  if (reduced() || el._scrambling) return
  if (!el.dataset.text) el.dataset.text = el.textContent
  if (!el.getAttribute('aria-label') && el.matches('a, button')) el.setAttribute('aria-label', el.dataset.text)
  el._scrambling = true
  let frame = 0
  const total = 18
  const tick = () => {
    const text = el.dataset.text // read each frame so a label change mid-scramble wins
    const out = [...text].map((ch, i) => {
      if (ch === ' ') return ch
      return frame / total > i / text.length ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0]
    }).join('')
    el.textContent = out
    if (++frame <= total) requestAnimationFrame(tick)
    else { el.textContent = el.dataset.text; el._scrambling = false }
  }
  tick()
}
export function initScramble() {
  document.querySelectorAll('[data-scramble]').forEach((el) => {
    el.addEventListener('pointerenter', () => scramble(el))
    el.addEventListener('focus', () => scramble(el))
  })
}

/* ---------- Magnetic elements ---------- */
export function initMagnetic() {
  if (!fine) return
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    const strength = 0.28
    el.addEventListener('pointermove', (e) => {
      if (reduced()) return
      const r = el.getBoundingClientRect()
      const x = e.clientX - (r.left + r.width / 2)
      const y = e.clientY - (r.top + r.height / 2)
      el.style.transform = `translate(${x * strength}px, ${y * strength}px)`
    })
    el.addEventListener('pointerleave', () => { el.style.transform = '' })
  })
}

/* ---------- Custom cursor ---------- */
export function initCursor() {
  if (!fine) return
  const dot = document.createElement('div')
  const ring = document.createElement('div')
  dot.className = 'cursor'
  ring.className = 'cursor-ring'
  ring.innerHTML = '<span></span>'
  document.body.append(dot, ring)
  document.documentElement.classList.add('has-cursor')
  const label = ring.firstChild
  let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, shown = false
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return
    x = e.clientX; y = e.clientY
    if (!shown) { shown = true; rx = x; ry = y; document.documentElement.classList.add('cursor-on') }
    const t = e.target.closest?.('a, button, [data-skill], input, [data-cursor]')
    const interactive = t && t.matches('a, button, [data-skill], input')
    ring.classList.toggle('is-link', !!interactive)
    const text = interactive ? t.dataset.cursor || '' : t?.dataset.cursor || ''
    label.textContent = text
    ring.classList.toggle('has-label', !!text)
  }, { passive: true })
  document.addEventListener('pointerleave', () => { shown = false; document.documentElement.classList.remove('cursor-on') })
  addEventListener('pointerdown', () => ring.classList.add('is-down'))
  addEventListener('pointerup', () => ring.classList.remove('is-down'))
  const loop = () => {
    const k = reduced() ? 1 : 0.18
    rx += (x - rx) * k; ry += (y - ry) * k
    dot.style.transform = `translate(${x}px, ${y}px)`
    ring.style.transform = `translate(${rx}px, ${ry}px)`
    requestAnimationFrame(loop)
  }
  loop()
}

/* ---------- Dialog helpers ---------- */
function openDialog(d) {
  if (d.open) return
  d.showModal()
  document.documentElement.classList.add('dialog-open')
}
function closeDialog(d) { if (d.open) d.close() }
document.querySelectorAll('dialog').forEach((d) => {
  d.addEventListener('close', () => document.documentElement.classList.remove('dialog-open'))
  // click on the backdrop closes
  d.addEventListener('click', (e) => { if (e.target === d) closeDialog(d) })
})

/* ---------- Quick view ---------- */
const quick = document.getElementById('quick')
export function openQuick() {
  openDialog(quick)
  achievements.unlock('skim')
}
export function initQuick() {
  document.querySelectorAll('[data-open-quick]').forEach((b) => b.addEventListener('click', openQuick))
  quick.querySelector('[data-close-quick]').addEventListener('click', () => closeDialog(quick))
}

/* ---------- Command palette ---------- */
const palette = document.getElementById('palette')
const input = palette.querySelector('[data-palette-input]')
const list = palette.querySelector('[data-palette-list]')
const achCount = palette.querySelector('[data-achievements-count]')
let commands = []
let filtered = []
let active = 0

export function initPalette(cmds) {
  commands = cmds
  document.querySelectorAll('[data-open-palette]').forEach((b) => b.addEventListener('click', openPalette))
  addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette.open ? closeDialog(palette) : openPalette() }
    else if (e.key === '/' && !isTyping(e.target) && !palette.open) { e.preventDefault(); openPalette() }
  })
  input.addEventListener('input', render)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    else if (e.key === 'Enter') { e.preventDefault(); run(filtered[active]) }
  })
  list.addEventListener('click', (e) => {
    const li = e.target.closest('[data-i]')
    if (li) run(filtered[+li.dataset.i])
  })
}
export function isTyping(t) { return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) }

function openPalette() {
  input.value = ''
  render()
  openDialog(palette)
  input.focus()
}
function render() {
  const q = input.value.trim().toLowerCase()
  filtered = commands.filter((c) => {
    if (c.secret) return q.length >= 4 && c.secret.some((s) => s.startsWith(q))
    return !q || (c.label + ' ' + (c.keywords || '') + ' ' + c.group).toLowerCase().includes(q)
  })
  active = 0
  let group = ''
  list.innerHTML = filtered.map((c, i) => {
    const head = c.group !== group ? `<li class="palette__group" role="presentation">${(group = c.group)}</li>` : ''
    return `${head}<li id="cmd-${i}" role="option" data-i="${i}" class="palette__item"><span>${c.label}</span>${c.hint ? `<kbd>${c.hint}</kbd>` : ''}</li>`
  }).join('') || '<li class="palette__empty">No matches — try “resume”, “email” or “play”.</li>'
  achCount.textContent = `${achievements.count} / ${achievements.total} achievements`
  highlight()
}
function move(d) {
  if (!filtered.length) return
  active = (active + d + filtered.length) % filtered.length
  highlight()
}
function highlight() {
  list.querySelectorAll('.palette__item').forEach((li) => li.classList.toggle('is-active', +li.dataset.i === active))
  const cur = list.querySelector(`#cmd-${active}`)
  input.setAttribute('aria-activedescendant', cur ? cur.id : '')
  cur?.scrollIntoView({ block: 'nearest' })
}
function run(cmd) {
  if (!cmd) return
  closeDialog(palette)
  setTimeout(() => cmd.run(), 60)
}
