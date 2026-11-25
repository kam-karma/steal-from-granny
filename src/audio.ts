import { createMusic, type Music, type MusicMode } from './music'

/** Every sound is synthesized: no files to download, tiny build. */
export interface Sfx {
  readonly unlock: () => void
  readonly slop: () => void
  readonly gulp: () => void
  readonly spit: () => void
  readonly hum: (note: number) => void
  readonly step: () => void
  readonly hmm: () => void
  readonly alarm: () => void
  readonly meow: () => void
  readonly hiss: () => void
  readonly crash: () => void
  readonly poke: () => void
  readonly hold: () => void
  readonly giggle: () => void
  readonly win: () => void
  readonly coin: () => void
  readonly nope: () => void
  readonly slurp: () => void
  readonly setSound: (on: boolean) => void
  readonly setMusic: (on: boolean) => void
  /** Silence everything while an ad plays. */
  readonly setAdMute: (on: boolean) => void
  readonly music: (m: MusicMode) => void
  readonly tension: (k: number) => void
  readonly suspend: () => void
  readonly resume: () => void
}

export function createSfx(): Sfx {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let sfxBus: GainNode | null = null
  let musicBus: GainNode | null = null
  let tunes: Music | null = null
  let sound = true
  let musicOn = true
  let adMuted = false
  let mode: MusicMode = 'off'
  let tensionK = 0
  let noiseBuf: AudioBuffer | null = null

  const now = (): number => ctx?.currentTime ?? 0

  function tone(freq: number, at: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, vibrato = 0): void {
    if (ctx === null || sfxBus === null) return
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, at)
    if (slideTo !== undefined) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur)
    if (vibrato > 0) {
      const lfo = ctx.createOscillator()
      const lg = ctx.createGain()
      lfo.frequency.value = 9
      lg.gain.value = vibrato
      lfo.connect(lg).connect(o.frequency)
      lfo.start(at)
      lfo.stop(at + dur + 0.05)
    }
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(vol, at + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    o.connect(g).connect(sfxBus)
    o.start(at)
    o.stop(at + dur + 0.05)
  }

  function noise(at: number, dur: number, type: BiquadFilterType, freq: number, vol: number, sweepTo?: number): void {
    if (ctx === null || sfxBus === null || noiseBuf === null) return
    const src = ctx.createBufferSource()
    src.buffer = noiseBuf
    src.loop = true
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.setValueAtTime(freq, at)
    if (sweepTo !== undefined) f.frequency.exponentialRampToValueAtTime(sweepTo, at + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(vol, at + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    src.connect(f).connect(g).connect(sfxBus)
    src.start(at)
    src.stop(at + dur + 0.05)
  }

  function unlock(): void {
    if (ctx !== null) {
      void ctx.resume()
      return
    }
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = adMuted ? 0 : 0.7
    master.connect(ctx.destination)
    sfxBus = ctx.createGain()
    sfxBus.gain.value = sound ? 1 : 0
    sfxBus.connect(master)
    musicBus = ctx.createGain()
    musicBus.gain.value = musicOn ? 1 : 0
    musicBus.connect(master)
    tunes = createMusic(ctx, musicBus)
    tunes.setMode(mode)
    tunes.setTension(tensionK)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1
  }

  // Granny's little tune, one note per call.
  const TUNE = [392, 440, 494, 440, 392, 330, 349, 392]

  return {
    unlock,
    slop: () => {
      const t = now()
      tone(520, t, 0.22, 'sine', 0.22, 140)
      noise(t, 0.12, 'lowpass', 900, 0.12, 200)
      tone(240, t + 0.12, 0.12, 'sine', 0.12, 380)
    },
    gulp: () => {
      const t = now()
      tone(300, t, 0.12, 'sine', 0.25, 120)
      tone(220, t + 0.13, 0.18, 'sine', 0.25, 80)
      noise(t + 0.1, 0.1, 'lowpass', 500, 0.1)
    },
    spit: () => {
      const t = now()
      noise(t, 0.12, 'bandpass', 1500, 0.2, 600)
      tone(180, t, 0.15, 'square', 0.06, 420)
    },
    hum: (k) => {
      const t = now()
      tone(TUNE[k % TUNE.length], t, 0.42, 'triangle', 0.035, undefined, 4)
    },
    step: () => {
      const t = now()
      noise(t, 0.08, 'lowpass', 260, 0.08)
    },
    hmm: () => {
      const t = now()
      tone(220, t, 0.35, 'triangle', 0.08, 330, 3)
    },
    alarm: () => {
      const t = now()
      tone(700, t, 0.5, 'sawtooth', 0.08, 1300, 30)
      for (let k = 0; k < 3; k++) {
        tone(988, t + 0.4 + k * 0.24, 0.12, 'square', 0.06)
        tone(740, t + 0.52 + k * 0.24, 0.12, 'square', 0.06)
      }
    },
    meow: () => {
      const t = now()
      tone(620, t, 0.18, 'sine', 0.14, 900, 20)
      tone(900, t + 0.17, 0.3, 'sine', 0.12, 500, 30)
    },
    hiss: () => {
      const t = now()
      noise(t, 0.6, 'highpass', 3000, 0.25, 5000)
    },
    crash: () => {
      const t = now()
      noise(t, 0.35, 'lowpass', 2400, 0.3, 300)
      tone(160, t, 0.25, 'square', 0.1, 60)
    },
    poke: () => {
      const t = now()
      tone(260, t, 0.16, 'sine', 0.2, 520)
    },
    hold: () => {
      const t = now()
      tone(140, t, 0.2, 'sine', 0.18, 110)
    },
    giggle: () => {
      const t = now()
      for (let k = 0; k < 5; k++) tone(900 + (k % 2) * 260, t + k * 0.07, 0.07, 'sine', 0.13)
    },
    win: () => {
      const t = now()
      ;[523, 659, 784, 1047, 1319].forEach((f, k) => tone(f, t + k * 0.1, 0.35, 'triangle', 0.15))
    },
    coin: () => {
      const t = now()
      tone(1319, t, 0.08, 'square', 0.04)
      tone(1760, t + 0.07, 0.14, 'square', 0.04)
    },
    slurp: () => {
      const t = now()
      noise(t, 0.6, 'bandpass', 600, 0.25, 2600)
      tone(200, t, 0.5, 'sawtooth', 0.06, 900)
    },
    nope: () => {
      const t = now()
      tone(300, t, 0.12, 'square', 0.06)
      tone(220, t + 0.12, 0.18, 'square', 0.06)
    },
    setSound: (on) => {
      sound = on
      if (sfxBus !== null) sfxBus.gain.value = on ? 1 : 0
    },
    setMusic: (on) => {
      musicOn = on
      if (musicBus !== null) musicBus.gain.value = on ? 1 : 0
    },
    setAdMute: (on) => {
      adMuted = on
      if (master !== null && ctx !== null) master.gain.setTargetAtTime(on ? 0 : 0.7, ctx.currentTime, 0.05)
    },
    music: (m) => {
      mode = m
      tunes?.setMode(m)
    },
    tension: (k) => {
      tensionK = k
      tunes?.setTension(k)
    },
    suspend: () => void ctx?.suspend(),
    resume: () => {
      if (!adMuted) void ctx?.resume()
    },
  }
}
