import type { PlayerInput, Vec } from './sim/types'

export interface GameInput {
  readonly read: () => PlayerInput
}

const KEYS: Record<string, [number, number]> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
}
const INTERACT = new Set(['KeyE', 'Space', 'Enter'])
const EYES = new Set(['ShiftLeft', 'ShiftRight', 'KeyF'])
const SPIT = new Set(['KeyQ'])

export interface Buttons {
  readonly act: HTMLElement
  readonly eyes: HTMLElement
  readonly spit: HTMLElement
}

/**
 * Move: WASD / arrows, a thumb joystick where you touch, or hold the mouse (walk to the cursor).
 * Act (tap = copy, hold = swallow): E / Space / big button. Eyes: Shift. Spit: Q.
 * The camera looks north, so screen-up is world -z.
 */
export function createInput(surface: HTMLElement, buttons: Buttons, playerOnScreen: () => { x: number; y: number }, onFirst: () => void): GameInput {
  const held = new Set<string>()
  const pad = document.createElement('div')
  pad.className = 'joy'
  const knob = document.createElement('div')
  knob.className = 'joy-knob'
  pad.appendChild(knob)
  document.body.appendChild(pad)

  let touchId: number | null = null
  let origin = { x: 0, y: 0 }
  let touchVec: Vec = { x: 0, z: 0 }
  let mouseDown = false
  let mouse = { x: 0, y: 0 }
  let first = true
  let actBtn = false
  let eyesBtn = false
  let spitQueued = false
  const radius = 60

  const wake = (): void => {
    if (first) {
      first = false
      onFirst()
    }
  }

  window.addEventListener('keydown', (e) => {
    if (KEYS[e.code] !== undefined || INTERACT.has(e.code) || EYES.has(e.code) || SPIT.has(e.code)) {
      if (SPIT.has(e.code) && !e.repeat) spitQueued = true
      held.add(e.code)
      e.preventDefault()
      wake()
    }
  })
  window.addEventListener('keyup', (e) => held.delete(e.code))
  window.addEventListener('blur', () => {
    held.clear()
    actBtn = false
    eyesBtn = false
  })

  function holdButton(el: HTMLElement, set: (on: boolean) => void): void {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      wake()
      el.setPointerCapture(e.pointerId)
      el.classList.add('down')
      set(true)
    })
    const up = (e: PointerEvent): void => {
      e.stopPropagation()
      el.classList.remove('down')
      set(false)
    }
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }
  holdButton(buttons.act, (on) => (actBtn = on))
  holdButton(buttons.eyes, (on) => (eyesBtn = on))
  holdButton(buttons.spit, (on) => {
    if (on) spitQueued = true
  })

  surface.addEventListener('pointerdown', (e) => {
    wake()
    if (e.pointerType === 'mouse') {
      mouseDown = true
      mouse = { x: e.clientX, y: e.clientY }
      return
    }
    if (touchId !== null) return
    touchId = e.pointerId
    origin = { x: e.clientX, y: e.clientY }
    touchVec = { x: 0, z: 0 }
    pad.style.left = `${origin.x}px`
    pad.style.top = `${origin.y}px`
    knob.style.transform = 'translate(-50%, -50%)'
    pad.classList.add('on')
  })
  surface.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') {
      mouse = { x: e.clientX, y: e.clientY }
      return
    }
    if (e.pointerId !== touchId) return
    const dx = e.clientX - origin.x
    const dy = e.clientY - origin.y
    const len = Math.hypot(dx, dy)
    const k = len > radius ? radius / len : 1
    knob.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`
    touchVec = len < 8 ? { x: 0, z: 0 } : { x: (dx * k) / radius, z: (dy * k) / radius }
  })
  const end = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') {
      mouseDown = false
      return
    }
    if (e.pointerId !== touchId) return
    touchId = null
    touchVec = { x: 0, z: 0 }
    pad.classList.remove('on')
  }
  surface.addEventListener('pointerup', end)
  surface.addEventListener('pointercancel', end)

  function move(): Vec {
    let x = 0
    let z = 0
    for (const code of held) {
      const v = KEYS[code]
      if (v !== undefined) {
        x += v[0]
        z += v[1]
      }
    }
    if (x !== 0 || z !== 0) {
      const l = Math.hypot(x, z)
      return { x: x / l, z: z / l }
    }
    if (touchId !== null) return touchVec
    if (mouseDown) {
      const p = playerOnScreen()
      const dx = mouse.x - p.x
      const dy = mouse.y - p.y
      const l = Math.hypot(dx, dy)
      if (l < 22) return { x: 0, z: 0 }
      return { x: dx / l, z: dy / l }
    }
    return { x: 0, z: 0 }
  }

  function read(): PlayerInput {
    const spit = spitQueued
    spitQueued = false
    return {
      move: move(),
      interact: actBtn || [...INTERACT].some((c) => held.has(c)),
      eyes: eyesBtn || [...EYES].some((c) => held.has(c)),
      spit,
    }
  }

  return { read }
}
