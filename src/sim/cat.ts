import { CAT, PLAYER } from './config'
import { CAT_BED, CAT_SPOTS } from './layout'
import { add, angleOf, canSee, collide, dirOf, dist, routeTo, scale, sub, turnToward, walkRoute, type Circle } from './geom'
import { formSize } from './player'
import { nextSeed, seedToUnit } from './rng'
import type { Cat, GameEvent, Player, Rules } from './types'
import type { Noise } from './owner'

export function newCat(): Cat {
  return { pos: CAT_BED, face: Math.PI / 2, mode: 'nap', timer: 7, route: [], from: null, target: null, cooldown: 0, trips: 0, hop: 0 }
}

export interface CatStep {
  readonly cat: Cat
  readonly player: Player
  readonly seed: number
  readonly events: readonly GameEvent[]
  readonly noise: Noise | null
}

const AWAKE: readonly Cat['mode'][] = ['wander', 'sit']

function goWander(c: Cat, seed: number, circles: readonly Circle[]): { cat: Cat; seed: number } {
  const s = nextSeed(seed)
  const toBed = c.trips >= 2
  const spot = toBed ? CAT_BED : CAT_SPOTS[Math.floor(seedToUnit(s) * CAT_SPOTS.length)]
  return { cat: { ...c, mode: 'wander', route: routeTo(c.pos, spot, circles), target: spot, trips: toBed ? 0 : c.trips + 1 }, seed: s }
}

/**
 * Pamuk the cat: naps, wanders, and reacts to the jelly.
 * Small disguises get pounced (and knocked out of shape), a cucumber scares her away,
 * and a bare jelly makes her meow for granny.
 */
export function stepCat(cat: Cat, player: Player, seed: number, circles: readonly Circle[], rules: Rules, dt: number): CatStep {
  const events: GameEvent[] = []
  let c: Cat = { ...cat, timer: cat.timer - dt, cooldown: Math.max(0, cat.cooldown - dt), hop: Math.max(0, cat.hop - dt) }
  let p = player
  let s = seed
  let noise: Noise | null = null

  const walk = (speed: number): void => {
    const w = walkRoute(c.pos, c.route, speed, dt, CAT.radius, circles)
    c = { ...c, pos: w.pos, route: w.route, face: w.heading === null ? c.face : turnToward(c.face, w.heading, 6 * dt) }
  }

  // Noticing the jelly.
  if (AWAKE.includes(c.mode) && c.cooldown <= 0 && canSee(c, p.pos, CAT.range, CAT.halfFov) && p.swallowing === null) {
    const size = formSize(p)
    if (size === null) {
      c = { ...c, mode: 'meow', timer: 1.2, cooldown: 3.5, face: angleOf(sub(p.pos, c.pos)) }
      events.push({ type: 'meow' }, { type: 'say', who: 'cat', line: { key: 'meow' } })
      noise = { pos: p.pos, amount: CAT.meowNoise, line: { key: 'catSaw' } }
    } else if (p.form === 'salatalik') {
      c = { ...c, mode: 'scared', timer: 3, route: routeTo(c.pos, CAT_BED, circles), cooldown: 9, hop: 0.7 }
      events.push({ type: 'catScared' }, { type: 'say', who: 'cat', line: { key: 'hiss' } })
    } else if (size === 'S' || size === 'XS') {
      c = { ...c, mode: 'stalk', timer: 6, route: [p.pos], target: p.pos }
    } else {
      c = { ...c, mode: 'sniff', timer: 1.6, route: [p.pos], target: p.pos, cooldown: 6 }
    }
  }

  switch (c.mode) {
    case 'nap':
      if (c.timer <= 0) {
        const r = goWander(c, s, circles)
        c = r.cat
        s = r.seed
      }
      break
    case 'wander':
      walk(CAT.walk)
      if (c.route.length === 0) {
        const atBed = dist(c.pos, CAT_BED) < 0.5
        c = atBed ? { ...c, mode: 'nap', timer: 9 + seedToUnit(s) * 5 } : { ...c, mode: 'sit', timer: 2 + seedToUnit(s) * 2 }
        s = nextSeed(s)
      }
      break
    case 'sit':
    case 'meow':
      if (c.timer <= 0) {
        const r = goWander(c, s, circles)
        c = r.cat
        s = r.seed
      }
      break
    case 'scared':
      walk(CAT.flee)
      if (c.route.length === 0) c = { ...c, mode: 'nap', timer: 10 }
      break
    case 'sniff': {
      if (dist(c.pos, p.pos) > 1.3) {
        c = { ...c, route: [p.pos] }
        walk(CAT.walk)
      } else c = { ...c, face: turnToward(c.face, angleOf(sub(p.pos, c.pos)), 6 * dt) }
      if (c.timer <= 0) c = { ...c, mode: 'sit', timer: 1.5 }
      break
    }
    case 'stalk': {
      const size = formSize(p)
      if (size !== 'S' || c.timer <= 0) {
        c = { ...c, mode: 'sit', timer: 1.2, cooldown: 3 }
        break
      }
      if (dist(c.pos, p.pos) > 1.6) {
        c = { ...c, route: [p.pos] }
        walk(CAT.stalk)
      } else {
        c = { ...c, mode: 'wiggle', timer: rules.catWiggle, face: angleOf(sub(p.pos, c.pos)) }
      }
      break
    }
    case 'wiggle':
      c = { ...c, face: turnToward(c.face, angleOf(sub(p.pos, c.pos)), 8 * dt) }
      if (c.timer <= 0) c = { ...c, mode: 'pounce', timer: CAT.pounceTime, from: c.pos, target: p.pos, hop: CAT.pounceTime }
      break
    case 'pounce': {
      const from = c.from ?? c.pos
      const to = c.target ?? c.pos
      const k = 1 - Math.max(0, c.timer) / CAT.pounceTime
      c = { ...c, pos: { x: from.x + (to.x - from.x) * k, z: from.z + (to.z - from.z) * k } }
      if (c.timer <= 0) {
        const size = formSize(p)
        const hit = dist(p.pos, to) < 1.1 && (size === 'S' || size === 'XS')
        if (hit) {
          const away = dirOf(c.face)
          p = { ...p, form: null, knocked: PLAYER.knockTime, pos: collide(add(p.pos, scale(away, 1.3)), PLAYER.radius, circles) }
          events.push({ type: 'pounce' }, { type: 'morph', kind: null }, { type: 'say', who: 'cat', line: { key: 'meow' } })
          noise = { pos: p.pos, amount: CAT.pounceNoise, line: { key: 'catKnocked' } }
        }
        c = { ...c, pos: collide(c.pos, CAT.radius, circles), mode: 'sit', timer: 1.6, cooldown: 4, from: null }
      }
      break
    }
  }
  return { cat: c, player: p, seed: s, events, noise }
}
