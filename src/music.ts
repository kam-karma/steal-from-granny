/**
 * Procedural background music: a little sneaky tune that changes with the night.
 * menu = soft lullaby, sneak = tip-toe pizzicato, chase = fast and loud. Tension adds a shaky string pad.
 * Notes are scheduled a little ahead on the AudioContext clock, so timing stays tight.
 */
export type MusicMode = 'off' | 'menu' | 'sneak' | 'chase'

export interface Music {
  readonly setMode: (m: MusicMode) => void
  readonly setTension: (k: number) => void
}

const A_MINOR = [220, 246.94, 261.63, 293.66, 329.63, 349.23, 392, 440, 493.88, 523.25, 587.33, 659.25]

// Degrees into the scale above; -1 = rest.
const SNEAK_BASS = [0, -1, 4, -1, 0, -1, 4, -1, 5, -1, 2, -1, 4, -1, 1, -1]
const SNEAK_TUNE = [7, -1, -1, 9, -1, 7, 6, -1, 4, -1, -1, -1, 5, 6, 7, -1, 9, -1, 10, -1, 9, 7, -1, -1, 6, -1, 4, -1, 2, -1, -1, -1]
const MENU_TUNE = [4, 6, 7, 9, 7, 6, 4, -1, 2, 4, 5, 7, 5, 4, 2, -1, 0, 2, 4, 6, 4, 2, 1, -1, 2, 4, 2, 1, 0, -1, -1, -1]
const CHASE_BASS = [0, 0, 7, 0, 5, 0, 7, 5, 0, 0, 7, 0, 3, 4, 5, 7]

export function createMusic(ctx: AudioContext, out: AudioNode): Music {
  const bus = ctx.createGain()
  bus.gain.value = 0.55
  bus.connect(out)

  let mode: MusicMode = 'off'
  let tension = 0
  let step = 0
  let next = ctx.currentTime + 0.1

  // A soft string pad that swells with tension.
  const pad = ctx.createGain()
  pad.gain.value = 0
  pad.connect(bus)
  const padFilter = ctx.createBiquadFilter()
  padFilter.type = 'lowpass'
  padFilter.frequency.value = 700
  padFilter.connect(pad)
  for (const f of [110, 164.81, 220.5]) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = f
    const trem = ctx.createOscillator()
    const tg = ctx.createGain()
    trem.frequency.value = 7
    tg.gain.value = 3
    trem.connect(tg).connect(o.frequency)
    o.connect(padFilter)
    o.start()
    trem.start()
  }

  function pluck(freq: number, at: number, dur: number, vol: number, type: OscillatorType = 'triangle'): void {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, at)
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(vol, at + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    o.connect(g).connect(bus)
    o.start(at)
    o.stop(at + dur + 0.05)
  }

  function tick(at: number, k: number): void {
    if (mode === 'menu') {
      const n = MENU_TUNE[k % MENU_TUNE.length]
      if (n >= 0) pluck(A_MINOR[n] * 2, at, 0.9, 0.05, 'sine')
      if (k % 8 === 0) pluck(A_MINOR[[0, 5, 3, 4][(k >> 3) % 4]] / 2, at, 2.2, 0.06, 'sine')
    } else if (mode === 'sneak') {
      const b = SNEAK_BASS[k % SNEAK_BASS.length]
      if (b >= 0) pluck(A_MINOR[b] / 2, at, 0.18, 0.13)
      const n = SNEAK_TUNE[k % SNEAK_TUNE.length]
      if (n >= 0 && (k >> 5) % 2 === 1) pluck(A_MINOR[n], at, 0.16, 0.05, 'square')
      if (tension > 0.3 && k % 2 === 1) pluck(4000, at, 0.03, 0.02 * tension, 'square')
    } else if (mode === 'chase') {
      const b = CHASE_BASS[k % CHASE_BASS.length]
      pluck(A_MINOR[b] / 2, at, 0.12, 0.16, 'sawtooth')
      if (k % 4 === 0) pluck(80, at, 0.15, 0.25, 'sine')
      if (k % 2 === 1) pluck(5000, at, 0.03, 0.03, 'square')
      if (k % 4 === 2) pluck(A_MINOR[(k >> 2) % 12], at, 0.1, 0.05, 'square')
    }
  }

  window.setInterval(() => {
    if (mode === 'off') {
      next = ctx.currentTime + 0.1
      return
    }
    const bpm = mode === 'chase' ? 160 : mode === 'menu' ? 84 : 104 + tension * 24
    const dur = 60 / bpm / 2
    while (next < ctx.currentTime + 0.25) {
      tick(next, step++)
      next += dur
    }
    pad.gain.setTargetAtTime(mode === 'chase' ? 0.05 : tension * 0.045, ctx.currentTime, 0.4)
  }, 60)

  return {
    setMode: (m) => {
      if (m === mode) return
      mode = m
      step = 0
      next = ctx.currentTime + 0.05
      if (m === 'off') pad.gain.setTargetAtTime(0, ctx.currentTime, 0.2)
    },
    setTension: (k) => {
      tension = Math.max(0, Math.min(1, k))
    },
  }
}
