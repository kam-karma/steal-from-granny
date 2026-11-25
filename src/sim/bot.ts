import { PROP_DEFS } from './catalog'
import { TICKLE } from './config'
import { hasTargets } from './game'
import { dist, navGrid, sub, len } from './geom'
import { EXIT } from './layout'
import { findPath } from './nav'
import { ownerSees } from './owner'
import { copyTarget, swallowTarget } from './player'
import type { GameState, PlayerInput, Vec } from './types'

/**
 * A careful player, used to check that every night can be won and to measure difficulty,
 * and as the "attract mode" in the menu background.
 * It walks unseen, freezes in a disguise when watched, taps in rhythm when poked, and steals.
 */
export interface Bot {
  readonly path: readonly Vec[]
  readonly replan: number
  readonly goal: number | 'exit' | null
  readonly hold: number
  readonly tap: number
  readonly greedy: boolean
}

export const newBot = (greedy = false): Bot => ({ path: [], replan: 0, goal: null, hold: 0, tap: 0, greedy })

const still = { x: 0, z: 0 }

function nextGoal(s: GameState, greedy: boolean): number | 'exit' {
  const want = greedy ? [...s.targets, ...s.bonus] : s.targets
  const left = want.filter((id) => !s.player.belly.includes(id) && s.props[id].present)
  if (left.length === 0 || (hasTargets(s) && s.player.belly.length >= s.rules.bellyMax)) return 'exit'
  return left.sort((a, b) => dist(s.props[a].pos, s.player.pos) - dist(s.props[b].pos, s.player.pos))[0]
}

function watched(s: GameState): boolean {
  return s.owners.some((o) => o.mode !== 'alarm' && ownerSees(o, s.player.pos, s.rules))
}

/** Is any calm owner looking at a point a little ahead of us? Then wait. */
function aheadWatched(s: GameState, p: Vec): boolean {
  return s.owners.some((o) => o.mode !== 'alarm' && ownerSees(o, p, s.rules))
}

export function botInput(bot: Bot, s: GameState, dt: number): { bot: Bot; input: PlayerInput } {
  const p = s.player
  // Being poked: tap on the beat.
  if (s.tickle !== null) {
    const t = s.tickle.t
    const press = !s.tickle.judged && Math.abs(t - TICKLE.hitAt) < 0.02
    return { bot, input: { move: still, interact: press, eyes: true, spit: false } }
  }
  if (p.swallowing !== null) return { bot, input: { move: still, interact: true, eyes: false, spit: false } }

  const alarm = s.owners.some((o) => o.mode === 'alarm')
  const seen = watched(s)

  // A short tap to copy (press one frame, release the next).
  if (bot.tap > 0) return { bot: { ...bot, tap: bot.tap - 1 }, input: { move: still, interact: bot.tap > 1, eyes: false, spit: false } }

  // Someone is coming to look nearby: become a thing and freeze until they leave.
  const coming = s.owners.some((o) => o.mode === 'investigate' && dist(o.pos, p.pos) < 8)
  if (coming && !alarm) {
    if (p.form === null && copyTarget(s.props, p) !== null) return { bot: { ...bot, tap: 2 }, input: { move: still, interact: true, eyes: true, spit: false } }
    if (p.form !== null) return { bot: { ...bot, hold: 0 }, input: { move: still, interact: false, eyes: true, spit: false } }
    // Nothing to hide as here: run to the nearest thing we can become.
    const hide = s.props
      .filter((q) => q.present && PROP_DEFS[q.kind].size !== 'XS')
      .sort((a, b) => dist(a.pos, p.pos) - dist(b.pos, p.pos))[0]
    if (hide !== undefined) {
      const d = sub(hide.pos, p.pos)
      const l = Math.max(1e-6, len(d))
      return { bot: { ...bot, path: [] }, input: { move: { x: d.x / l, z: d.z / l }, interact: false, eyes: false, spit: false } }
    }
  }
  if (seen && !alarm) {
    if (p.form === null && copyTarget(s.props, p) !== null) return { bot: { ...bot, tap: 2 }, input: { move: still, interact: true, eyes: true, spit: false } }
    return { bot: { ...bot, hold: 0 }, input: { move: still, interact: false, eyes: true, spit: false } }
  }

  const goal = nextGoal(s, bot.greedy)
  const goalPos = goal === 'exit' ? { x: EXIT.x, z: EXIT.z } : s.props[goal].pos

  // At the target: hold to swallow.
  if (goal !== 'exit') {
    const t = swallowTarget(s.props, p)
    if (t !== null && t.id === goal && !alarm) {
      if (bot.hold > 0.1 && p.holdUsed) return { bot: { ...bot, hold: 0 }, input: { move: still, interact: false, eyes: false, spit: false } }
      return { bot: { ...bot, hold: bot.hold + dt }, input: { move: still, interact: true, eyes: false, spit: false } }
    }
  }
  if (p.holding) return { bot: { ...bot, hold: 0 }, input: { move: still, interact: false, eyes: false, spit: false } }

  let b: Bot = { ...bot, replan: bot.replan - dt }
  if (b.replan <= 0 || b.goal !== goal || b.path.length === 0) {
    const circles = s.props
      .filter((q) => q.present && PROP_DEFS[q.kind].size !== 'XS' && (goal === 'exit' || q.id !== goal))
      .map((q) => ({ pos: q.pos, r: PROP_DEFS[q.kind].radius }))
    b = { ...b, goal, replan: 0.5, path: findPath(navGrid(), p.pos, goalPos, circles, 0.42) ?? [goalPos] }
  }
  let path = b.path
  while (path.length > 1 && dist(path[0], p.pos) < 0.35) path = path.slice(1)
  const next = path[0] ?? goalPos
  const d = sub(next, p.pos)
  const l = len(d)
  const dir = l < 1e-6 ? still : { x: d.x / l, z: d.z / l }
  // Peek one step ahead: if someone would see us there, stay put (disguised) and wait.
  if (!alarm && aheadWatched(s, { x: p.pos.x + dir.x * 1.2, z: p.pos.z + dir.z * 1.2 })) {
    if (p.form === null && copyTarget(s.props, p) !== null) return { bot: { ...b, path, tap: 2 }, input: { move: still, interact: true, eyes: true, spit: false } }
    return { bot: { ...b, path }, input: { move: still, interact: false, eyes: true, spit: false } }
  }
  // Never drop the disguise or walk off right next to someone who just looked.
  const close = s.owners.some((o) => dist(o.pos, p.pos) < 4.5 && o.mode !== 'patrol')
  if (close && p.form !== null && !alarm) return { bot: { ...b, path }, input: { move: still, interact: false, eyes: true, spit: false } }
  // Out of sight in a disguise: turn back into jelly to move faster (tap with nothing near does it).
  if (p.form !== null && !alarm && copyTarget(s.props, p) === null) return { bot: { ...b, path, tap: 2 }, input: { move: still, interact: true, eyes: false, spit: false } }
  return { bot: { ...b, path }, input: { move: dir, interact: false, eyes: false, spit: false } }
}
