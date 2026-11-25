import { PROP_DEFS } from './catalog'
import { OWNER } from './config'
import { angleOf, canSee, dist, routeTo, sub, turnToward, walkRoute, type Circle } from './geom'
import { roomAt } from './layout'
import type { OwnerDef } from './nights'
import { formSize } from './player'
import type { GameEvent, MemoryEntry, Owner, Player, Prop, Rules, Size, Speech, Vec } from './types'

export interface Noise {
  readonly pos: Vec
  readonly amount: number
  readonly line: Speech
}

interface Thing {
  readonly pos: Vec
  readonly size: Size
  readonly propId: number | null
  readonly player: boolean
}

export function newOwner(def: OwnerDef, props: readonly Prop[]): Owner {
  const wp = def.patrol[0]
  const hold = wp.hold ?? OWNER.sweepHold
  return {
    kind: def.kind,
    pos: { x: wp.x, z: wp.z },
    face: wp.sweep[0] ?? Math.PI / 2,
    mode: 'wait',
    patrol: def.patrol,
    wp: 0,
    timer: wp.sweep.length * hold,
    hold,
    route: [],
    target: null,
    sweep: wp.sweep,
    suspicion: 0,
    memory: freshMemory(props),
    lostTimer: 0,
    alert: def.alert === true,
    seesPlayer: false,
    speedMul: def.speedMul,
    rangeMul: def.rangeMul,
    fovMul: def.torch === true ? 0.42 : 1,
    torch: def.torch === true,
  }
}

/** She knows her own house: every thing where it stands. */
export function freshMemory(props: readonly Prop[]): readonly MemoryEntry[] {
  return props
    .filter((p) => p.present && PROP_DEFS[p.kind].size !== 'XS')
    .map((p) => ({ pos: p.pos, size: PROP_DEFS[p.kind].size, propId: p.id, player: false }))
}

export const ownerRange = (o: Owner, rules: Rules): number => rules.ownerRange * o.rangeMul * (o.alert ? 1.2 : 1)

export const ownerFov = (o: Owner, rules: Rules): number => rules.halfFov * o.fovMul

export function ownerSees(o: Owner, pos: Vec, rules: Rules): boolean {
  return canSee(o, pos, ownerRange(o, rules), ownerFov(o, rules))
}

function thingsNow(props: readonly Prop[], player: Player): Thing[] {
  const things: Thing[] = props
    .filter((p) => p.present && PROP_DEFS[p.kind].size !== 'XS')
    .map((p) => ({ pos: p.pos, size: PROP_DEFS[p.kind].size, propId: p.id, player: false }))
  const size = formSize(player)
  if (size !== null && player.swallowing === null) things.push({ pos: player.pos, size, propId: null, player: true })
  return things
}

interface Change {
  readonly amount: number
  readonly pos: Vec
  readonly line: Speech
}

interface MemoryResult {
  readonly memory: readonly MemoryEntry[]
  readonly changes: readonly Change[]
  readonly treasureGone: boolean
}

/**
 * "Spot the difference": for every spot she can see right now, compare what she
 * remembers there with what stands there. Only the size of a thing matters to her.
 */
export function compareMemory(o: Owner, props: readonly Prop[], player: Player, rules: Rules, targets: readonly number[]): MemoryResult {
  const vis = (p: Vec): boolean => ownerSees(o, p, rules)
  const seenMem = o.memory.filter((m) => vis(m.pos))
  const seen = thingsNow(props, player).filter((t) => vis(t.pos))
  const left = [...seen]
  const kept: MemoryEntry[] = []
  const changes: Change[] = []
  let treasureGone = false
  const k = rules.memoryMul

  for (const m of seenMem) {
    const i = left.findIndex((t) => t.size === m.size && dist(t.pos, m.pos) < OWNER.matchDist)
    if (i >= 0) {
      const t = left[i]
      left.splice(i, 1)
      kept.push({ pos: t.pos, size: t.size, propId: m.propId, player: t.player })
      continue
    }
    const believed = m.propId === null ? undefined : props.find((p) => p.id === m.propId)
    if (believed !== undefined && targets.includes(believed.id)) {
      treasureGone = true
      changes.push({ amount: OWNER.missing * 1.6 * k, pos: m.pos, line: { key: 'treasureGone', kind: believed.kind } })
    } else if (believed !== undefined) {
      changes.push({ amount: OWNER.missing * k, pos: m.pos, line: { key: 'missing', kind: believed.kind } })
    } else {
      changes.push({ amount: OWNER.missing * k, pos: m.pos, line: { key: 'missingUnknown' } })
    }
  }

  for (const t of left) {
    if (t.player && player.form !== null) {
      const room = roomAt(t.pos)
      const def = PROP_DEFS[player.form]
      const fits = def.homes.includes(room)
      changes.push({
        amount: (fits ? OWNER.newHome : OWNER.newOutOfPlace * rules.outOfPlaceMul) * k,
        pos: t.pos,
        line: fits ? { key: 'newHere', kind: player.form } : { key: 'outOfPlace', kind: player.form, room },
      })
    } else if (!t.player) {
      changes.push({ amount: OWNER.movedProp * k, pos: t.pos, line: { key: 'moved' } })
    }
    kept.push({ pos: t.pos, size: t.size, propId: t.propId, player: t.player })
  }

  return { memory: [...o.memory.filter((m) => !vis(m.pos)), ...kept], changes, treasureGone }
}

function directGain(o: Owner, player: Player, rules: Rules, dt: number, learned: string | null): number {
  if (!ownerSees(o, player.pos, rules)) return 0
  const d = dist(o.pos, player.pos)
  if (player.form === null) return (rules.blobRate + rules.blobNearRate * (1 - d / ownerRange(o, rules))) * dt
  if (player.moving) return rules.statueRate * dt
  // She learned to distrust the disguise the jelly loves most.
  const habit = learned !== null && player.form === learned && d < 6 ? 9 : 0
  if (!player.eyesClosed && d < rules.eyesDist) return (rules.eyesRate + habit) * dt
  return habit * dt
}

export interface OwnerCtx {
  readonly index: number
  readonly player: Player
  readonly props: readonly Prop[]
  readonly targets: readonly number[]
  readonly noise: Noise | null
  readonly circles: readonly Circle[]
  readonly rules: Rules
  readonly dt: number
  readonly tickleFree: boolean
  readonly learned: string | null
  /** While true the jelly cannot be spotted directly. */
  readonly grace: boolean
}

export interface OwnerStep {
  readonly owner: Owner
  readonly events: readonly GameEvent[]
  readonly startTickle: boolean
  readonly caught: boolean
}

const CALM: readonly Owner['mode'][] = ['patrol', 'wait', 'lookaround', 'search']

function lookAround(o: Owner, time: number): Owner {
  const f = o.face
  return { ...o, mode: 'lookaround', timer: time, hold: time / 3, sweep: [f + 1.1, f - 1.1, f], route: [] }
}

function backToPatrol(o: Owner, circles: readonly Circle[]): Owner {
  const wp = o.patrol[o.wp]
  return { ...o, mode: 'patrol', route: routeTo(o.pos, { x: wp.x, z: wp.z }, circles), target: null }
}

function sweepFace(o: Owner, rules: Rules, dt: number): number {
  const total = o.sweep.length * o.hold
  const idx = Math.min(o.sweep.length - 1, Math.max(0, Math.floor((total - o.timer) / o.hold)))
  return turnToward(o.face, o.sweep[idx] ?? o.face, rules.ownerTurn * dt)
}

/** An owner: patrols, looks, remembers, gets suspicious, comes to poke, and chases. */
export function stepOwner(owner: Owner, ctx: OwnerCtx): OwnerStep {
  const { index, player, props, noise, dt, rules, targets } = ctx
  const events: GameEvent[] = []
  if (owner.mode === 'tickle') return { owner, events, startTickle: false, caught: false }

  let o = owner
  const sees = ownerSees(o, player.pos, rules)
  const direct = ctx.grace ? 0 : directGain(o, player, rules, dt, ctx.learned)
  let change: Change | null = null

  if (o.mode !== 'alarm') {
    const mem = compareMemory(o, props, player, rules, targets)
    o = { ...o, memory: mem.memory, alert: o.alert || mem.treasureGone }
    const total = mem.changes.reduce((s, c) => s + c.amount, 0)
    if (total > 0) {
      const top = [...mem.changes].sort((a, b) => b.amount - a.amount)[0]
      change = { ...top, amount: total }
    }
  }
  if (noise !== null && o.mode !== 'alarm') {
    change = { amount: (change?.amount ?? 0) + noise.amount, pos: noise.pos, line: noise.line }
  }

  let s = o.suspicion + direct
  if (change !== null) {
    s = Math.max(s, Math.min(OWNER.memoryCap, s + change.amount))
    events.push({ type: 'suspicious', owner: index, pos: change.pos }, { type: 'say', who: 'owner', owner: index, line: change.line })
  } else if (direct > 0 && o.suspicion < 25 && s >= 25) {
    const habit = ctx.learned !== null && player.form === ctx.learned && !player.moving
    events.push({ type: 'say', who: 'owner', owner: index, line: habit ? { key: 'learned', kind: player.form ?? undefined } : { key: 'hm' } })
  }
  if (direct === 0 && change === null && o.mode !== 'alarm') s = Math.max(0, s - rules.decay * dt)
  o = { ...o, suspicion: Math.min(100, s), seesPlayer: sees }

  if (o.mode !== 'alarm' && o.suspicion >= 100) {
    events.push({ type: 'alarm', owner: index }, { type: 'say', who: 'owner', owner: index, line: { key: player.form === null ? 'alarmBlob' : 'alarmMoved' } })
    o = { ...o, mode: 'alarm', target: player.pos, route: [], lostTimer: 0, alert: true }
  } else if (CALM.includes(o.mode) && o.suspicion >= OWNER.investigateAt && (change !== null || direct > 0)) {
    const target = change !== null ? change.pos : player.pos
    o = { ...o, mode: 'investigate', target, route: routeTo(o.pos, target, ctx.circles) }
  } else if (o.mode === 'investigate' && direct > 0) {
    o = { ...o, target: player.pos, route: dist(o.target ?? o.pos, player.pos) > 1 ? routeTo(o.pos, player.pos, ctx.circles) : o.route }
  }

  return moveOwner(o, ctx, events)
}

function moveOwner(owner: Owner, ctx: OwnerCtx, events: GameEvent[]): OwnerStep {
  const { index, player, circles, dt, rules } = ctx
  let o = owner
  const walk = (speed: number, turn: number = rules.ownerTurn): void => {
    const w = walkRoute(o.pos, o.route, speed * o.speedMul, dt, OWNER.radius, circles)
    o = { ...o, pos: w.pos, route: w.route, face: w.heading === null ? o.face : turnToward(o.face, w.heading, turn * dt) }
  }

  switch (o.mode) {
    case 'patrol': {
      walk(rules.walk)
      if (o.route.length === 0) {
        const wp = o.patrol[o.wp]
        const hold = wp.hold ?? OWNER.sweepHold
        o = { ...o, mode: 'wait', timer: wp.sweep.length * hold, hold, sweep: wp.sweep }
      }
      break
    }
    case 'wait': {
      o = { ...o, face: sweepFace(o, rules, dt), timer: o.timer - dt }
      if (o.timer <= 0) o = backToPatrol({ ...o, wp: (o.wp + 1) % o.patrol.length }, circles)
      break
    }
    case 'lookaround':
    case 'search': {
      o = { ...o, face: sweepFace(o, rules, dt), timer: o.timer - dt }
      if (o.timer <= 0) o = backToPatrol({ ...o, suspicion: Math.min(o.suspicion, 30) }, circles)
      break
    }
    case 'investigate': {
      const target = o.target ?? o.pos
      if (dist(o.pos, target) > 1.05) walk(rules.curious)
      if (dist(o.pos, target) <= 1.05 || o.route.length === 0) {
        const there = player.form !== null && player.swallowing === null && dist(player.pos, target) < 1.6
        if (there && ctx.tickleFree) {
          o = { ...o, mode: 'tickle', face: angleOf(sub(player.pos, o.pos)), route: [] }
          events.push({ type: 'tickleStart' })
          return { owner: o, events, startTickle: true, caught: false }
        }
        o = lookAround(o, 2.6)
        events.push({ type: 'say', who: 'owner', owner: index, line: { key: 'nothing' } })
      }
      break
    }
    case 'alarm': {
      const sees = ownerSees(o, player.pos, rules) || dist(o.pos, player.pos) < 2
      const target = sees ? player.pos : (o.target ?? player.pos)
      // Re-plan only when the target has moved, so the chase stays cheap.
      const stale = o.route.length === 0 || dist(o.route[o.route.length - 1], target) > 0.8
      o = { ...o, target, lostTimer: sees ? 0 : o.lostTimer + dt, route: stale ? routeTo(o.pos, target, circles) : o.route, suspicion: 100 }
      walk(rules.chase, 7)
      if (dist(o.pos, player.pos) < rules.catchDist) {
        events.push({ type: 'caught' }, { type: 'say', who: 'owner', owner: index, line: { key: 'caught' } })
        return { owner: o, events, startTickle: false, caught: true }
      }
      if (o.lostTimer > OWNER.lostAfter || (!sees && dist(o.pos, target) < 0.6)) {
        events.push({ type: 'lost', owner: index }, { type: 'say', who: 'owner', owner: index, line: { key: 'lost' } })
        const f = o.face
        o = { ...o, mode: 'search', suspicion: 60, lostTimer: 0, timer: OWNER.searchTime, hold: OWNER.searchTime / 4, sweep: [f + 1.5, f - 1.5, f + 3.1, f], route: [] }
      }
      break
    }
    default:
      break
  }
  return { owner: o, events, startTickle: false, caught: false }
}

/** After a successful tickle: she accepts what she poked as a real object. */
export function acceptPlayer(o: Owner, player: Player): Owner {
  const size = formSize(player)
  const memory = size === null ? o.memory : [...o.memory.filter((m) => dist(m.pos, player.pos) > 0.3), { pos: player.pos, size, propId: null, player: true }]
  return lookAround({ ...o, memory, suspicion: 0 }, 1.6)
}

export function startAlarm(o: Owner, player: Player): Owner {
  return { ...o, mode: 'alarm', target: player.pos, route: [], lostTimer: 0, suspicion: 100, alert: true }
}
