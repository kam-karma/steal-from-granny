import { PLAYER } from './config'
import { add, angleOf, collide, dirOf, dist, routeTo, scale, turnToward, walkRoute, type Circle } from './geom'
import type { Noise } from './owner'
import { formSize } from './player'
import type { GameEvent, Player, Vacuum, Vec } from './types'

/** The robot vacuum's loop through the front rooms and the living room. */
export const VACUUM_LOOP: readonly Vec[] = [
  { x: -6.5, z: 8.5 },
  { x: 1.5, z: 7.8 },
  { x: 6.5, z: 6.8 },
  { x: 13.5, z: 6.2 },
  { x: 6.5, z: 3.8 },
  { x: -1.0, z: 2.2 },
  { x: 0.0, z: -2.5 },
  { x: -3.5, z: -4.0 },
  { x: 0.5, z: -1.0 },
]

export const VACUUM = { radius: 0.38, speed: 1.25, reach: 0.85, noise: 35 } as const

export function newVacuum(): Vacuum {
  return { pos: VACUUM_LOOP[0], face: 0, route: [], wp: 0, pause: 1 }
}

export interface VacuumStep {
  readonly vacuum: Vacuum
  readonly player: Player
  readonly events: readonly GameEvent[]
  readonly noise: Noise | null
}

/**
 * Drives its loop, pausing at each stop. Bumping into a small disguise sucks it in
 * and spits it out as plain jelly with a loud slurp the owners can hear.
 */
export function stepVacuum(v: Vacuum, player: Player, circles: readonly Circle[], dt: number): VacuumStep {
  let vac: Vacuum = { ...v, pause: Math.max(0, v.pause - dt) }
  let p = player
  const events: GameEvent[] = []
  let noise: Noise | null = null

  if (vac.pause <= 0) {
    if (vac.route.length === 0) {
      const wp = (vac.wp + 1) % VACUUM_LOOP.length
      vac = { ...vac, wp, route: routeTo(vac.pos, VACUUM_LOOP[wp], circles) }
    }
    const w = walkRoute(vac.pos, vac.route, VACUUM.speed, dt, VACUUM.radius, circles)
    vac = { ...vac, pos: w.pos, route: w.route, face: w.heading === null ? vac.face : turnToward(vac.face, w.heading, 4 * dt) }
    if (w.route.length === 0) vac = { ...vac, pause: 1.5 }
  }

  const size = formSize(p)
  // Only small disguises get sucked; a bare jelly is quick enough to hop aside.
  const small = size === 'S' || size === 'XS'
  if (small && p.knocked <= 0 && p.swallowing === null && dist(vac.pos, p.pos) < VACUUM.reach) {
    const away = dirOf(angleOf({ x: p.pos.x - vac.pos.x, z: p.pos.z - vac.pos.z }))
    p = { ...p, form: null, knocked: PLAYER.knockTime, pos: collide(add(p.pos, scale(away, 1.4)), PLAYER.radius, circles) }
    events.push({ type: 'sucked' }, { type: 'morph', kind: null })
    noise = { pos: p.pos, amount: VACUUM.noise, line: { key: 'vacuum' } }
    vac = { ...vac, pause: 1.2 }
  }
  return { vacuum: vac, player: p, events, noise }
}
