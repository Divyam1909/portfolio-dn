// Generative ambient sound: a soft drone whose filter opens with scroll speed, wind that
// rises during flights, and pentatonic plucks for clicks. Off until the visitor opts in.

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21]

export function createAudio() {
  let ctx = null, master, filter, wind, windGain, windFilter, echo
  let on = false
  let frame = 0

  function init() {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)

    // shared echo for plucks
    echo = ctx.createDelay(1)
    echo.delayTime.value = 0.32
    const fb = ctx.createGain()
    fb.gain.value = 0.35
    const wet = ctx.createGain()
    wet.gain.value = 0.35
    echo.connect(fb).connect(echo)
    echo.connect(wet).connect(master)

    filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 500
    filter.Q.value = 0.8
    filter.connect(master)

    ;[55, 82.41, 110, 164.81].forEach((f, i) => {
      const o = ctx.createOscillator()
      o.type = i % 2 ? 'sine' : 'triangle'
      o.frequency.value = f
      o.detune.value = (i - 1.5) * 7
      const g = ctx.createGain()
      const base = [0.2, 0.11, 0.08, 0.035][i]
      g.gain.value = base
      o.connect(g).connect(filter)
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 0.05 + i * 0.031
      const lg = ctx.createGain()
      lg.gain.value = base * 0.6
      lfo.connect(lg).connect(g.gain)
      o.start()
      lfo.start()
    })

    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    wind = ctx.createBufferSource()
    wind.buffer = buf
    wind.loop = true
    windFilter = ctx.createBiquadFilter()
    windFilter.type = 'bandpass'
    windFilter.frequency.value = 700
    windFilter.Q.value = 0.9
    windGain = ctx.createGain()
    windGain.gain.value = 0.015
    wind.connect(windFilter).connect(windGain).connect(master)
    wind.start()
  }

  function note(freq, when, gain = 0.2, dur = 1.4) {
    const o = ctx.createOscillator()
    const o2 = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o2.type = 'triangle'
    o.frequency.value = freq
    o2.frequency.value = freq * 2.001
    const g2 = ctx.createGain()
    g2.gain.value = 0.18
    g.gain.setValueAtTime(0, when)
    g.gain.linearRampToValueAtTime(gain, when + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    o.connect(g)
    o2.connect(g2).connect(g)
    g.connect(master)
    g.connect(echo)
    o.start(when)
    o2.start(when)
    o.stop(when + dur + 0.05)
    o2.stop(when + dur + 0.05)
  }

  return {
    get on() { return on },
    async toggle() {
      if (!ctx) init()
      on = !on
      if (on) await ctx.resume()
      master.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.35)
      return on
    },
    update({ vel, flight }) {
      if (!on || ++frame % 3) return
      const t = ctx.currentTime
      filter.frequency.setTargetAtTime(420 + Math.min(Math.abs(vel), 3000) * 0.5 + flight * 1400, t, 0.15)
      windGain.gain.setTargetAtTime(0.015 + flight * 0.22, t, 0.12)
      windFilter.frequency.setTargetAtTime(600 + flight * 2200, t, 0.12)
    },
    pluck(nx = 0) {
      if (!on) return
      const i = Math.max(0, Math.min(SCALE.length - 1, Math.round(((nx + 1) / 2) * (SCALE.length - 1))))
      note(220 * Math.pow(2, SCALE[i] / 12), ctx.currentTime)
    },
    chime() {
      if (!on) return
      const t = ctx.currentTime
      ;[0, 4, 7, 12].forEach((s, k) => note(440 * Math.pow(2, s / 12), t + k * 0.09, 0.14, 1.8))
    },
  }
}
