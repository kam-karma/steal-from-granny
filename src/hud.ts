import { ic, iconUrl, rich, type Portrait } from './icons'
import { ownerName, propName, t } from './i18n'
import { createMinimap } from './minimap'
import { PROP_DEFS } from './sim/catalog'
import { TICKLE } from './sim/config'
import type { GameState, Owner, Tickle, Who } from './sim/types'


export interface Pt {
  readonly x: number
  readonly y: number
}

export interface HudView {
  readonly owners: readonly Pt[]
  readonly cat: Pt
  readonly player: Pt
  readonly hint: string | null
  readonly hold: number
  readonly pip: boolean
}

export interface Hud {
  readonly root: HTMLElement
  readonly buttons: { act: HTMLElement; eyes: HTMLElement; spit: HTMLElement }
  readonly pipRect: () => { x: number; y: number; w: number; h: number }
  readonly update: (s: GameState, view: HudView) => void
  readonly say: (who: Who, owner: number, text: string) => void
  readonly toast: (text: string, kind: 'good' | 'bad' | 'info') => void
  readonly floater: (p: Pt, text: string, color: string) => void
  readonly ring: (p: Pt) => void
  readonly show: (on: boolean) => void
  /** A big teaching card for the first night. */
  readonly coach: (text: string, seconds: number) => void
  /** Re-write fixed labels after a language change. */
  readonly relabel: () => void
  readonly onPause: (fn: () => void) => void
}

export function el(cls: string, parent: HTMLElement, html = '', tag = 'div'): HTMLElement {
  const e = document.createElement(tag)
  e.className = cls
  e.innerHTML = html
  parent.appendChild(e)
  return e
}

function ownerStatus(o: Owner): [Portrait, string] {
  const w = ownerName(o.kind)
  const face = (mood: 'Calm' | 'Sus' | 'Alarm'): Portrait => `${o.kind}${mood}` as Portrait
  if (o.mode === 'alarm') return [face('Alarm'), t('stAlarm', { w })]
  if (o.mode === 'tickle') return [face('Sus'), t('stTickle', { w })]
  if (o.mode === 'investigate') return [face('Sus'), t('stInvestigate', { w })]
  if (o.mode === 'search') return [face('Sus'), t('stSearch', { w })]
  if (o.suspicion > 25) return [face('Sus'), t('stHm', { w })]
  if (o.mode === 'wait' || o.mode === 'lookaround') return [face('Calm'), t('stLook', { w })]
  return [face('Calm'), t('stWalk', { w })]
}

export function createHud(parent: HTMLElement): Hud {
  const root = el('game-ui', parent)
  const ui = el('ui', root)

  const statusBox = el('statusbox', ui)
  const statuses = [0, 1].map(() => {
    const st = el('status', statusBox)
    const face = el('face', st, '', 'img') as HTMLImageElement
    face.alt = ''
    const right = el('srt', st)
    const label = el('slabel', right)
    const bar = el('sbar', right)
    const fill = el('sfill', bar)
    return { st, face, label, fill }
  })

  const bag = el('bag', ui, ic('belly', 'belly'))
  const slotsBox = el('slots', bag)
  const gold = el('gold', bag)
  const list = el('targets note', ui)

  const minimap = createMinimap(ui)
  const coach = el('coach note', ui)
  let coachUntil = 0
  const pip = el('pip', ui, `<span class="note">${t('pip')}</span>`)
  const hint = el('hint note', ui)
  const holdRing = el('holdring', ui, '<svg viewBox="0 0 44 44"><circle class="bg" cx="22" cy="22" r="17"/><circle class="fg" cx="22" cy="22" r="18"/></svg>')
  const holdCircle = holdRing.querySelector('.fg') as SVGCircleElement

  const ownerBubbles = [0, 1].map(() => el('bubble note', ui))
  const catBubble = el('bubble cat note', ui)
  const until = { o0: 0, o1: 0, cat: 0 }
  let clock = 0

  const dark = el('dark', ui)
  const tickleBox = el('tickle', ui, `<div class="tk-title note">${ic('feather')}<span>${t('tickle')}</span></div><div class="tk-target"><div class="tk-ring"></div></div><div class="tk-pips"></div>`)
  const tkRing = tickleBox.querySelector('.tk-ring') as HTMLElement
  const tkPips = tickleBox.querySelector('.tk-pips') as HTMLElement
  const toastEl = el('toast', ui)
  let toastTimer = 0

  const pad = el('pad', root)
  const act = el('btn act jelly', pad, `<img src="${iconUrl('grab')}" alt=""><small>${t('btnAct')}</small><kbd>E</kbd>`, 'button')
  const eyes = el('btn eyes jelly grape', pad, `<img src="${iconUrl('hide')}" alt=""><small>${t('btnEyes')}</small><kbd>Shift</kbd>`, 'button')
  const spit = el('btn spit jelly sky', pad, `<img src="${iconUrl('spit')}" alt=""><small>${t('btnSpit')}</small><kbd>Q</kbd>`, 'button')
  const pause = el('pausebtn jelly soft', root, `<img src="${iconUrl('pause')}" alt="">`, 'button')
  pause.setAttribute('aria-label', 'Pause')

  let slotCount = -1

  function pipRect(): { x: number; y: number; w: number; h: number } {
    const w = window.innerWidth < 700 ? 170 : 250
    const h = Math.round(w * 0.64)
    return { x: window.innerWidth - w - 14, y: 70, w, h }
  }

  function place(e: HTMLElement, p: Pt, dy = 0): void {
    e.style.left = `${p.x}px`
    e.style.top = `${p.y + dy}px`
  }

  function renderTickle(t: Tickle | null, window: number): void {
    tickleBox.classList.toggle('show', t !== null)
    if (t === null) return
    const k = t.t / TICKLE.hitAt
    tkRing.style.transform = `translate(-50%, -50%) scale(${Math.max(0.15, 1 + (1 - k) * 1.8)})`
    tkRing.classList.toggle('near', Math.abs(t.t - TICKLE.hitAt) <= window)
    tkPips.innerHTML =
      Array.from({ length: TICKLE.pokes }, (_, i) => `<i class="${i < t.poke ? 'done' : i === t.poke ? 'now' : ''}"></i>`).join('') + ic('flame').repeat(t.misses)
  }

  function renderTargets(s: GameState): void {
    const row = (id: number, main: boolean): string => {
      const p = s.props[id]
      const got = s.player.belly.includes(id)
      return `<div class="${got ? 'got' : ''} ${main ? 'main' : ''}">${ic(got ? 'check' : main ? 'target' : 'star')}${ic(p.kind, 'item')}<span>${propName(p.kind)}</span></div>`
    }
    const allMain = s.targets.every((id) => s.player.belly.includes(id))
    list.innerHTML =
      s.targets.map((id) => row(id, true)).join('') +
      s.bonus.map((id) => row(id, false)).join('') +
      (allMain ? `<div class="go">${rich(t('goWindow'))}</div>` : '')
  }

  let lastList: string | null = null
  let lastHint: string | null = null
  let lastGold = -1
  function update(s: GameState, view: HudView): void {
    clock = s.time
    s.owners.forEach((o, i) => {
      const st = statuses[i]
      const [f, txt] = ownerStatus(o)
      const src = iconUrl(f)
      if (st.face.getAttribute('src') !== src) st.face.setAttribute('src', src)
      st.label.textContent = txt
      st.fill.style.width = `${o.suspicion}%`
      st.st.classList.toggle('alarm', o.mode === 'alarm')
      st.st.classList.toggle('warn', o.mode !== 'alarm' && o.suspicion > 25)
    })
    statuses.forEach((st, i) => st.st.classList.toggle('hide', i >= s.owners.length))

    if (slotCount !== s.rules.bellyMax) {
      slotCount = s.rules.bellyMax
      slotsBox.innerHTML = Array.from({ length: slotCount }, () => '<i class="slot"></i>').join('')
    }
    const slots = slotsBox.querySelectorAll('.slot')
    slots.forEach((slot, i) => {
      const id = s.player.belly[i]
      const prop = id === undefined ? undefined : s.props.find((p) => p.id === id)
      const kind = prop === undefined ? '' : prop.kind
      if ((slot as HTMLElement).dataset.k !== kind) {
        ;(slot as HTMLElement).dataset.k = kind
        slot.innerHTML = prop === undefined ? '' : `<img src="${iconUrl(prop.kind)}" alt="">`
      }
      slot.classList.toggle('full', prop !== undefined)
    })
    const loot = s.player.belly.reduce((sum, id) => sum + PROP_DEFS[s.props[id].kind].value, 0)
    const goldNow = Math.round(loot * s.rules.coinMul)
    if (goldNow !== lastGold) {
      lastGold = goldNow
      gold.innerHTML = `${ic('coin')}${goldNow}`
    }
    const key = s.player.belly.join(',')
    if (key !== lastList) {
      lastList = key
      renderTargets(s)
    }

    const r = pipRect()
    pip.classList.toggle('show', view.pip)
    pip.style.left = `${r.x}px`
    pip.style.top = `${r.y}px`
    pip.style.width = `${r.w}px`
    pip.style.height = `${r.h}px`
    pip.classList.toggle('hot', s.owners.some((o) => o.suspicion > 25))

    if ((view.hint ?? '') !== lastHint) {
      lastHint = view.hint ?? ''
      hint.innerHTML = rich(lastHint)
    }
    hint.classList.toggle('show', view.hint !== null && s.tickle === null)
    holdRing.classList.toggle('show', view.hold > 0)
    place(holdRing, view.player, -95)
    holdCircle.style.strokeDashoffset = `${113 * (1 - Math.min(1, view.hold))}`

    ownerBubbles.forEach((b, i) => {
      b.classList.toggle('show', i < s.owners.length && clock < (i === 0 ? until.o0 : until.o1))
      if (view.owners[i] !== undefined) place(b, view.owners[i], -10)
    })
    catBubble.classList.toggle('show', clock < until.cat)
    place(catBubble, view.cat, -10)

    minimap.update(s, s.time)
    coach.classList.toggle('show', clock < coachUntil)
    dark.classList.toggle('show', s.player.eyesClosed)
    renderTickle(s.tickle, s.rules.tickleWindow)
    toastTimer -= 1 / 60
    if (toastTimer <= 0) toastEl.classList.remove('show')
  }

  function say(who: Who, owner: number, text: string): void {
    if (who === 'cat') {
      catBubble.innerHTML = rich(text)
      until.cat = clock + 1.6
    } else {
      ownerBubbles[owner === 1 ? 1 : 0].innerHTML = rich(text)
      if (owner === 1) until.o1 = clock + 2.4
      else until.o0 = clock + 2.4
    }
  }

  return {
    root,
    buttons: { act, eyes, spit },
    pipRect,
    update,
    say,
    toast: (text, kind) => {
      toastEl.innerHTML = rich(text)
      toastEl.className = `toast show ${kind}`
      toastTimer = 1.8
    },
    floater: (p, text, color) => {
      const f = el('floater', ui, rich(text))
      f.style.color = color
      place(f, p, -60)
      window.setTimeout(() => f.remove(), 1200)
    },
    ring: (p) => {
      const r = el('soundring', ui)
      place(r, p)
      window.setTimeout(() => r.remove(), 900)
    },
    show: (on) => {
      root.classList.toggle('off', !on)
      lastList = null
      slotCount = -1
    },
    onPause: (fn) => pause.addEventListener('click', fn),
    coach: (text, seconds) => {
      coach.innerHTML = rich(text)
      coachUntil = clock + seconds
    },
    relabel: () => {
      ;(pip.querySelector('span') as HTMLElement).textContent = t('pip')
      ;(tickleBox.querySelector('.tk-title span') as HTMLElement).textContent = t('tickle')
      ;(act.querySelector('small') as HTMLElement).innerHTML = t('btnAct')
      ;(eyes.querySelector('small') as HTMLElement).textContent = t('btnEyes')
      ;(spit.querySelector('small') as HTMLElement).textContent = t('btnSpit')
      lastList = null
    },
  }
}
