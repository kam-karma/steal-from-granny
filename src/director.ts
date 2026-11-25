import type { Sfx } from './audio'
import { propName, speech, t } from './i18n'
import type { Hud, Pt } from './hud'
import { PROP_DEFS } from './sim/catalog'
import { PLAYER } from './sim/config'
import { hasTargets } from './sim/game'
import { dist } from './sim/geom'
import { EXIT } from './sim/layout'
import { ownerSees } from './sim/owner'
import { copyTarget, gapsNear, spitCandidate, swallowTarget } from './sim/player'
import type { GameEvent, GameState } from './sim/types'
import type { Fx } from './render/fx'
import type { JellyView } from './render/jelly'

export interface Director {
  readonly event: (e: GameEvent, s: GameState) => void
  readonly tick: (dt: number, s: GameState, owners: readonly Pt[], cat: Pt) => void
  readonly hint: (s: GameState) => string | null
  readonly holdProgress: (s: GameState) => number
  readonly shake: () => number
  /** Kinds the jelly copied or swallowed this night, for the album. */
  readonly seenKinds: () => readonly string[]
  /** Counters for the daily quests, this night so far. */
  readonly counts: () => NightCounts
  /** How many times each disguise was taken this night. */
  readonly uses: () => Readonly<Record<string, number>>
  readonly reset: () => void
  readonly setTrailColor: (c: number) => void
}

export interface NightCounts {
  readonly loot: number
  readonly swaps: number
  readonly catScared: number
  readonly tickles: number
  readonly kinds: number
  readonly eyesClosedSec: number
}

/** Turns game events into sound, text and particles, and picks the hint a kid needs right now. */
export function createDirector(hud: Hud, sfx: Sfx, fx: Fx, jelly: JellyView, toScreen: (x: number, y: number, z: number) => Pt): Director {
  let shake = 0
  let trailT = 0
  let trailColor = 0x2fe08f
  let humT = 0
  let humNote = 0
  const stepT = [0, 0]
  let catStepT = 0
  let lastOwners: Array<{ x: number; z: number }> = []
  let lastCat = { x: 0, z: 0 }
  let seen = new Set<string>()
  let uses: Record<string, number> = {}
  let lootIds = new Set<number>()
  let counts = { loot: 0, swaps: 0, catScared: 0, tickles: 0, eyesClosedSec: 0 }

  function event(e: GameEvent, s: GameState): void {
    const p = s.player.pos
    const at = toScreen(p.x, 1, p.z)
    switch (e.type) {
      case 'morph':
        sfx.slop()
        fx.splash(p.x, 0.6, p.z, 0x5cf0b0)
        jelly.squish()
        if (e.kind !== null) {
          seen.add(e.kind)
          uses = { ...uses, [e.kind]: (uses[e.kind] ?? 0) + 1 }
        }
        break
      case 'swallow': {
        sfx.gulp()
        const prop = s.props.find((q) => q.id === e.propId)
        if (prop !== undefined) {
          seen.add(prop.kind)
          const def = PROP_DEFS[prop.kind]
          if (def.value > 0) {
            // Count each piece once, even if it was put back after a catch and swallowed again.
            if (!lootIds.has(prop.id)) counts = { ...counts, loot: counts.loot + 1 }
            lootIds = new Set([...lootIds, prop.id])
            sfx.coin()
            fx.coins(p.x, 1, p.z)
            hud.floater(at, `+${Math.round(def.value * s.rules.coinMul)} 🪙`, '#ffe066')
          }
          if (s.targets.includes(prop.id)) hud.toast(hasTargets(s) ? t('tAllGot') : t('tGot', { k: propName(prop.kind) }), 'good')
          else if (s.bonus.includes(prop.id)) hud.toast(t('tBonus', { k: propName(prop.kind) }), 'good')
        }
        break
      }
      case 'full':
        sfx.nope()
        hud.toast(t('tFull'), 'info')
        break
      case 'spit':
        sfx.spit()
        fx.splash(p.x, 0.5, p.z, 0x5cf0b0, 6)
        if (e.filled) {
          counts = { ...counts, swaps: counts.swaps + 1 }
          hud.toast(t('tSwap'), 'good')
        }
        break
      case 'say':
        hud.say(e.who, e.owner ?? 0, speech(e.line))
        break
      case 'suspicious':
        sfx.hmm()
        break
      case 'alarm':
        sfx.alarm()
        hud.toast(t('tAlarm'), 'bad')
        shake = 0.8
        break
      case 'lost':
        hud.toast(t('tLost'), 'good')
        break
      case 'tickleStart':
        sfx.poke()
        break
      case 'pokeHit':
        sfx.poke()
        jelly.squish()
        hud.floater(at, t('fHit'), '#ffffff')
        break
      case 'pokeMiss':
        sfx.giggle()
        jelly.giggle()
        hud.floater(at, t('fMiss'), '#ff8a80')
        break
      case 'tickleDone':
        counts = { ...counts, tickles: counts.tickles + 1 }
        hud.toast(t('tFooled'), 'good')
        break
      case 'sucked':
        sfx.slurp()
        fx.splash(p.x, 0.6, p.z, 0x5cf0b0, 14)
        shake = 0.3
        hud.toast(t('tSucked'), 'bad')
        break
      case 'pounce':
        sfx.crash()
        fx.stars(p.x, 1.1, p.z)
        shake = 0.4
        hud.toast(t('tPounce'), 'bad')
        break
      case 'catScared':
        counts = { ...counts, catScared: counts.catScared + 1 }
        sfx.hiss()
        hud.toast(t('tScared'), 'good')
        break
      case 'meow':
        sfx.meow()
        break
      case 'needMain':
        sfx.nope()
        hud.toast(t('tNeed'), 'info')
        break
      case 'win':
        sfx.win()
        fx.coins(p.x, 1, p.z)
        break
      default:
        break
    }
  }

  function tick(dt: number, s: GameState, owners: readonly Pt[], catPt: Pt): void {
    shake = Math.max(0, shake - dt)
    // A fading jelly trail while the bare jelly hops around.
    trailT -= dt
    if (s.player.moving && s.player.form === null && trailT <= 0) {
      fx.trail(s.player.pos.x, s.player.pos.z, trailColor)
      trailT = 0.18
    }
    if (s.player.eyesClosed && s.phase === 'play') counts = { ...counts, eyesClosedSec: counts.eyesClosedSec + dt }
    humT -= dt
    s.owners.forEach((o, i) => {
      const prev = lastOwners[i] ?? o.pos
      const walking = dist(o.pos, prev) / Math.max(dt, 1e-4) > 0.3
      // Teyze hums while she walks her rounds: when the humming stops, she is about to look.
      if (i === 0 && walking && o.mode === 'patrol' && humT <= 0) {
        sfx.hum(humNote++)
        humT = 0.45
      }
      stepT[i] -= dt
      if (walking && stepT[i] <= 0) {
        sfx.step()
        stepT[i] = o.mode === 'alarm' ? 0.25 : 0.5
        if (s.player.eyesClosed && owners[i] !== undefined) hud.ring(owners[i])
      }
    })
    lastOwners = s.owners.map((o) => o.pos)
    if (s.cat !== null) {
      catStepT -= dt
      if (dist(s.cat.pos, lastCat) > 0.004 && catStepT <= 0) {
        catStepT = 0.45
        if (s.player.eyesClosed) hud.ring(catPt)
      }
      lastCat = s.cat.pos
    }
  }

  function hint(s: GameState): string | null {
    const p = s.player
    if (s.tickle !== null || p.swallowing !== null || s.phase !== 'play') return null
    const watching = s.owners.some((o) => o.mode !== 'alarm' && ownerSees(o, p.pos, s.rules))
    if (watching) return p.form === null ? t('hSeenBlob') : t('hFreeze')
    if (s.owners.some((o) => o.mode === 'alarm')) return t('hRun')
    if (s.owners.some((o) => o.mode === 'investigate' && dist(o.pos, p.pos) < 6)) return t('hComing')
    const canSpit = spitCandidate(p, s.props, s.targets) !== undefined
    if (canSpit && gapsNear(s.props, p.pos, 1.8).length > 0) return t('hSpit')
    const sw = swallowTarget(s.props, p)
    if (sw !== null && PROP_DEFS[sw.kind].value > 0) return t('hSwallow', { k: propName(sw.kind).toLocaleUpperCase() })
    const cp = copyTarget(s.props, p)
    if (cp !== null && cp.kind !== p.form) return t('hCopy', { k: propName(cp.kind) })
    if (hasTargets(s) && dist(p.pos, EXIT) > 3) return t('hExit')
    if (p.form !== null && cp === null) return t('hBlob')
    if (s.time < 8) return t('hStart')
    return null
  }

  function holdProgress(s: GameState): number {
    const p = s.player
    if (!p.holding || p.holdUsed || p.swallowing !== null) return 0
    if (swallowTarget(s.props, p) === null) return 0
    return p.holdTime / PLAYER.holdToSwallow
  }

  return {
    event,
    tick,
    hint,
    holdProgress,
    shake: () => shake,
    seenKinds: () => [...seen],
    counts: () => ({ ...counts, kinds: seen.size }),
    uses: () => uses,
    setTrailColor: (c) => {
      trailColor = c
    },
    reset: () => {
      seen = new Set()
      uses = {}
      lootIds = new Set()
      counts = { loot: 0, swaps: 0, catScared: 0, tickles: 0, eyesClosedSec: 0 }
      lastOwners = []
    },
  }
}
