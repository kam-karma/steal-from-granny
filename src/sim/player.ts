import { PROP_DEFS } from './catalog'
import { PLAYER } from './config'
import { add, angleOf, collide, dirOf, dist, len, scale, type Circle } from './geom'
import { SPAWN } from './layout'
import type { GameEvent, Player, PlayerInput, Prop, Rules, Size, Vec } from './types'

export function newPlayer(): Player {
  return {
    pos: SPAWN,
    face: 0,
    form: null,
    formRot: 0,
    belly: [],
    eyesClosed: false,
    holding: false,
    holdTime: 0,
    holdUsed: false,
    swallowing: null,
    moving: false,
    knocked: 0,
  }
}

export function formSize(p: Player): Size | null {
  return p.form === null ? null : PROP_DEFS[p.form].size
}

export function playerSpeed(p: Player, rules: Rules): number {
  const base = p.form === null ? rules.blobSpeed : PLAYER.speedBySize[PROP_DEFS[p.form].size]
  const slowed = base * (1 - PLAYER.bellySlow * p.belly.length)
  return p.eyesClosed ? slowed * 0.45 : slowed
}

/** Nearest usable thing in range; `bias` makes some things count as closer than they are. */
function nearest(props: readonly Prop[], pos: Vec, range: number, ok: (p: Prop) => boolean, bias: (p: Prop) => number = () => 0): Prop | null {
  let best: Prop | null = null
  let bestScore = Infinity
  for (const p of props) {
    if (!p.present || !ok(p)) continue
    const d = dist(p.pos, pos)
    if (d > range) continue
    const score = d - bias(p)
    if (score < bestScore) {
      best = p
      bestScore = score
    }
  }
  return best
}

export const copyTarget = (props: readonly Prop[], p: Player): Prop | null =>
  nearest(props, p.pos, PLAYER.copyRange, (q) => PROP_DEFS[q.kind].size !== 'XS')

/** Loot wins over plain things nearby, so a ring hiding under a plant can still be grabbed. */
export const swallowTarget = (props: readonly Prop[], p: Player): Prop | null =>
  nearest(props, p.pos, PLAYER.swallowRange, (q) => PROP_DEFS[q.kind].size !== 'L', (q) => (PROP_DEFS[q.kind].value > 0 ? 0.8 : 0))

export interface PlayerStep {
  readonly player: Player
  readonly props: readonly Prop[]
  readonly events: readonly GameEvent[]
}

function finishSwallow(player: Player, props: readonly Prop[]): PlayerStep {
  const sw = player.swallowing
  if (sw === null) return { player, props, events: [] }
  const prop = props.find((q) => q.id === sw.propId)
  if (prop === undefined) return { player: { ...player, swallowing: null }, props, events: [] }
  const tiny = PROP_DEFS[prop.kind].size === 'XS'
  const morph: GameEvent[] = tiny ? [] : [{ type: 'morph', kind: prop.kind }]
  return {
    player: {
      ...player,
      swallowing: null,
      belly: [...player.belly, prop.id],
      form: tiny ? player.form : prop.kind,
      formRot: tiny ? player.formRot : prop.rot,
      pos: tiny ? player.pos : prop.pos,
    },
    props: props.map((q) => (q.id === prop.id ? { ...q, present: false } : q)),
    events: [{ type: 'swallow', propId: prop.id }, ...morph],
  }
}

/** A gap = where something was swallowed and nothing stands now. */
export function gapsNear(props: readonly Prop[], pos: Vec, range: number): Prop[] {
  return props
    .filter((q) => !q.present && dist(q.pos, pos) < range)
    .filter((q) => !props.some((o) => o.present && dist(o.pos, q.pos) < 0.6))
    .sort((a, b) => dist(a.pos, pos) - dist(b.pos, pos))
}

/** What a spit would bring up: the last plain thing, or else the last loot the night does not need. */
export function spitCandidate(player: Player, props: readonly Prop[], keep: readonly number[]): number | undefined {
  const last = [...player.belly].reverse()
  const kindOf = (k: number): Prop | undefined => props.find((q) => q.id === k)
  return (
    last.find((k) => {
      const p = kindOf(k)
      return p !== undefined && PROP_DEFS[p.kind].value === 0
    }) ?? last.find((k) => kindOf(k) !== undefined && !keep.includes(k))
  )
}

/** Spit something out, into a nearby gap if there is one (the swap trick). */
function spit(player: Player, props: readonly Prop[], circles: readonly Circle[], keep: readonly number[]): PlayerStep {
  const id = spitCandidate(player, props, keep)
  if (id === undefined) return { player, props, events: [] }
  const item = props.find((q) => q.id === id) as Prop
  const gap = gapsNear(
    props.filter((q) => q.id !== item.id),
    player.pos,
    1.8,
  )[0]
  const filled = gap !== undefined && PROP_DEFS[gap.kind].size === PROP_DEFS[item.kind].size
  const spot = gap !== undefined ? gap.pos : collide(add(player.pos, scale(dirOf(player.face), 0.95)), 0.35, circles)
  let pos = player.pos
  if (dist(pos, spot) < 0.8) pos = collide(add(spot, scale(dirOf(player.face + Math.PI), 0.95)), PLAYER.radius, circles)
  return {
    player: { ...player, pos, belly: player.belly.filter((k) => k !== item.id) },
    props: props.map((q) => (q.id === item.id ? { ...q, present: true, pos: spot, rot: gap?.rot ?? q.rot } : q)),
    events: [{ type: 'spit', propId: item.id, filled }],
  }
}

/**
 * Press and release = copy the nearest thing's shape (or turn back into jelly if nothing is near).
 * Press and hold = swallow it: you steal it and stand in its place, in its shape.
 */
export function stepPlayer(player: Player, props: readonly Prop[], input: PlayerInput, dt: number, circles: readonly Circle[], rules: Rules, keep: readonly number[] = []): PlayerStep {
  const events: GameEvent[] = []
  let p: Player = { ...player, knocked: Math.max(0, player.knocked - dt) }
  let ps = props

  if (p.swallowing !== null) {
    const sw = p.swallowing
    const t = sw.t + dt
    const target = ps.find((q) => q.id === sw.propId)
    const k = Math.min(1, t / PLAYER.swallowTime)
    const pos = target === undefined ? p.pos : { x: sw.from.x + (target.pos.x - sw.from.x) * k, z: sw.from.z + (target.pos.z - sw.from.z) * k }
    p = { ...p, swallowing: { ...sw, t }, pos, moving: false, holding: input.interact }
    if (t >= PLAYER.swallowTime) {
      const r = finishSwallow(p, ps)
      return { player: r.player, props: r.props, events: [...events, ...r.events] }
    }
    return { player: p, props: ps, events }
  }

  if (input.interact) {
    const holdTime = p.holding ? p.holdTime + dt : 0
    const holdUsed = p.holding ? p.holdUsed : false
    p = { ...p, holding: true, holdTime, holdUsed }
    if (!holdUsed && holdTime >= PLAYER.holdToSwallow && p.knocked <= 0) {
      const target = swallowTarget(ps, p)
      if (target !== null && p.belly.length >= rules.bellyMax) {
        events.push({ type: 'full' })
        p = { ...p, holdUsed: true }
      } else if (target !== null) {
        p = { ...p, holdUsed: true, swallowing: { propId: target.id, t: 0, from: p.pos }, moving: false }
        events.push({ type: 'swallowStart', propId: target.id })
        return { player: p, props: ps, events }
      }
    }
  } else if (p.holding) {
    if (!p.holdUsed && p.knocked <= 0) {
      const target = copyTarget(ps, p)
      p = { ...p, form: target === null ? null : target.kind, formRot: target === null ? 0 : target.rot }
      events.push({ type: 'morph', kind: p.form })
    }
    p = { ...p, holding: false, holdTime: 0, holdUsed: false }
  }

  if (input.spit && p.knocked <= 0) {
    const r = spit(p, ps, circles, keep)
    p = r.player
    ps = r.props
    events.push(...r.events)
  }

  p = { ...p, eyesClosed: input.eyes }

  const m = input.move
  const ml = len(m)
  if (ml > 0.1 && p.knocked <= 0 && !p.holding) {
    const speed = playerSpeed(p, rules) * Math.min(1, ml)
    const next = collide(add(p.pos, scale(m, (speed * dt) / ml)), PLAYER.radius, circles)
    p = { ...p, pos: next, face: angleOf(m), moving: true }
  } else {
    p = { ...p, moving: false }
  }
  return { player: p, props: ps, events }
}
