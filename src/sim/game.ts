import { stepCat, newCat } from './cat'
import { PROP_DEFS, PROP_START } from './catalog'
import { makeRules, TICKLE } from './config'
import { dist, type Circle } from './geom'
import { EXIT } from './layout'
import { NIGHTS } from './nights'
import { acceptPlayer, freshMemory, newOwner, startAlarm, stepOwner, type Noise } from './owner'
import { gapsNear, newPlayer, stepPlayer } from './player'
import type { GameEvent, GameState, Owner, PlayerInput, Prop, PropKind, Result, Rules } from './types'
import { newVacuum, stepVacuum } from './vacuum'

export function startProps(): readonly Prop[] {
  return PROP_START.map((p, id) => ({ id, kind: p.kind, pos: { x: p.x, z: p.z }, origin: { x: p.x, z: p.z }, rot: p.rot ?? 0, present: true }))
}

const idsOf = (props: readonly Prop[], kinds: readonly PropKind[]): number[] =>
  kinds.map((k) => props.find((p) => p.kind === k)?.id).filter((id): id is number => id !== undefined)

export function createGame(seed = 1, night = 0, rules: Rules = makeRules('orta'), habit: PropKind | null = null): GameState {
  const def = NIGHTS[Math.max(0, Math.min(NIGHTS.length - 1, night))]
  const props = startProps()
  const nightRules = def.memoryMul === undefined ? rules : { ...rules, memoryMul: rules.memoryMul * def.memoryMul }
  return {
    time: 0,
    seed,
    phase: 'play',
    night,
    rules: nightRules,
    player: newPlayer(),
    owners: def.owners.map((o) => newOwner(o, props)),
    cat: def.cat ? newCat() : null,
    vacuum: def.vacuum === true ? newVacuum() : null,
    dark: def.dark === true,
    learned: def.learns === true ? habit : null,
    props,
    targets: idsOf(props, def.targets),
    bonus: idsOf(props, def.bonus),
    tickle: null,
    alarmed: false,
    result: null,
    nagCooldown: 0,
    grace: 1.5,
  }
}

export interface Step {
  readonly state: GameState
  readonly events: readonly GameEvent[]
}

const propCircles = (props: readonly Prop[]): Circle[] =>
  props.filter((p) => p.present && PROP_DEFS[p.kind].size !== 'XS').map((p) => ({ pos: p.pos, r: PROP_DEFS[p.kind].radius }))

const replaceAt = <T>(xs: readonly T[], i: number, x: T): T[] => xs.map((y, k) => (k === i ? x : y))

/** An owner pokes the thing three times; tap in rhythm so the jelly does not giggle. */
function stepTickle(state: GameState, input: PlayerInput, dt: number): Step {
  const tk0 = state.tickle
  if (tk0 === null) return { state, events: [] }
  const events: GameEvent[] = []
  const pressed = input.interact && !state.player.holding
  let tk = { ...tk0, t: tk0.t + dt }
  const window = state.rules.tickleWindow
  if (!tk.judged) {
    if (pressed) {
      const hit = Math.abs(tk.t - TICKLE.hitAt) <= window
      tk = { ...tk, judged: true, misses: tk.misses + (hit ? 0 : 1) }
      events.push({ type: hit ? 'pokeHit' : 'pokeMiss' })
    } else if (tk.t > TICKLE.hitAt + window) {
      tk = { ...tk, judged: true, misses: tk.misses + 1 }
      events.push({ type: 'pokeMiss' })
    }
  }
  const player = { ...state.player, holding: input.interact, holdUsed: true, holdTime: 0, moving: false }
  const owner = state.owners[tk.owner]

  if (tk.misses >= TICKLE.maxMisses) {
    events.push({ type: 'alarm', owner: tk.owner }, { type: 'say', who: 'owner', owner: tk.owner, line: { key: 'giggled' } })
    return { state: { ...state, player, tickle: null, alarmed: true, owners: replaceAt(state.owners, tk.owner, startAlarm(owner, player)) }, events }
  }
  if (tk.t >= TICKLE.pokeTime) {
    if (!tk.judged) {
      tk = { ...tk, misses: tk.misses + 1 }
      events.push({ type: 'pokeMiss' })
      if (tk.misses >= TICKLE.maxMisses) {
        events.push({ type: 'alarm', owner: tk.owner }, { type: 'say', who: 'owner', owner: tk.owner, line: { key: 'giggled' } })
        return { state: { ...state, player, tickle: null, alarmed: true, owners: replaceAt(state.owners, tk.owner, startAlarm(owner, player)) }, events }
      }
    }
    tk = { ...tk, poke: tk.poke + 1, t: 0, judged: false }
    if (tk.poke >= TICKLE.pokes) {
      events.push({ type: 'tickleDone' }, { type: 'say', who: 'owner', owner: tk.owner, line: { key: 'fooled', kind: player.form ?? undefined } })
      return { state: { ...state, player, tickle: null, owners: replaceAt(state.owners, tk.owner, acceptPlayer(owner, player)) }, events }
    }
  }
  return { state: { ...state, player, tickle: tk }, events }
}

export function bellyKinds(state: GameState): PropKind[] {
  return state.player.belly.map((id) => state.props.find((p) => p.id === id)?.kind).filter((k): k is PropKind => k !== undefined)
}

function finish(state: GameState): Result {
  const loot = bellyKinds(state).filter((k) => PROP_DEFS[k].value > 0)
  const gold = Math.round(loot.reduce((s, k) => s + PROP_DEFS[k].value, 0) * state.rules.coinMul)
  const allBonus = state.bonus.every((id) => state.player.belly.includes(id))
  return { loot, gold, stars: [true, allBonus, !state.alarmed] }
}

export const hasTargets = (state: GameState): boolean => state.targets.every((id) => state.player.belly.includes(id))

/** Count of gaps left in the house (things swallowed and not replaced). */
export const gapCount = (state: GameState): number => gapsNear(state.props, { x: 0, z: 0 }, 1e9).length

/** The cat's noise reaches the nearest calm owner. */
function routeNoise(owners: readonly Owner[], noise: Noise | null): number {
  if (noise === null) return -1
  let best = -1
  let bd = Infinity
  owners.forEach((o, i) => {
    const d = dist(o.pos, noise.pos)
    if (o.mode !== 'alarm' && o.mode !== 'tickle' && d < bd) {
      bd = d
      best = i
    }
  })
  return best
}

export function stepGame(state: GameState, input: PlayerInput, dt: number): Step {
  if (state.phase !== 'play') return { state, events: [] }
  const timed: GameState = { ...state, time: state.time + dt, nagCooldown: Math.max(0, state.nagCooldown - dt), grace: Math.max(0, state.grace - dt) }
  if (timed.tickle !== null) return stepTickle(timed, input, dt)

  const events: GameEvent[] = []
  const rules = timed.rules
  const ps = stepPlayer(timed.player, timed.props, input, dt, propCircles(timed.props), rules, timed.targets)
  events.push(...ps.events)
  const circles = propCircles(ps.props)
  let player = ps.player
  let cat = timed.cat
  let seed = timed.seed
  let noise: Noise | null = null
  if (cat !== null) {
    const cs = stepCat(cat, player, seed, circles, rules, dt)
    events.push(...cs.events)
    cat = cs.cat
    player = cs.player
    seed = cs.seed
    noise = cs.noise
  }
  let vacuum = timed.vacuum
  if (vacuum !== null) {
    const vs = stepVacuum(vacuum, player, circles, dt)
    events.push(...vs.events)
    vacuum = vs.vacuum
    player = vs.player
    noise = noise ?? vs.noise
  }
  const hearer = routeNoise(timed.owners, noise)

  let tickleOwner = -1
  let caught = false
  const owners = timed.owners.map((o, i) => {
    const os = stepOwner(o, {
      index: i,
      player,
      props: ps.props,
      targets: timed.targets,
      noise: i === hearer ? noise : null,
      circles,
      rules,
      dt,
      tickleFree: tickleOwner < 0,
      learned: timed.learned,
      grace: timed.grace > 0,
    })
    events.push(...os.events)
    if (os.startTickle) tickleOwner = i
    if (os.caught) caught = true
    return os.owner
  })

  let next: GameState = { ...timed, player, props: ps.props, cat, vacuum, seed, owners, alarmed: timed.alarmed || owners.some((o) => o.mode === 'alarm') }

  if (tickleOwner >= 0) {
    next = { ...next, tickle: { owner: tickleOwner, poke: 0, t: 0, misses: 0, judged: false } }
    events.push({ type: 'say', who: 'owner', owner: tickleOwner, line: { key: 'poke', kind: next.player.form ?? undefined } })
  }
  if (caught) return { state: { ...next, phase: 'caught' }, events }

  if (dist(next.player.pos, EXIT) < EXIT.r) {
    if (hasTargets(next)) {
      events.push({ type: 'win' })
      return { state: { ...next, phase: 'won', result: finish(next) }, events }
    }
    if (next.nagCooldown <= 0) {
      events.push({ type: 'needMain' })
      next = { ...next, nagCooldown: 4 }
    }
  }
  return { state: next, events }
}

/** Keep going after being caught. With keepLoot the belly stays full (the rewarded-ad option). */
export function continueAfterCaught(state: GameState, keepLoot: boolean): GameState {
  const belly = keepLoot ? state.player.belly : []
  const props = keepLoot ? state.props : state.props.map((p) => (state.player.belly.includes(p.id) ? { ...p, present: true, pos: p.origin } : p))
  const def = NIGHTS[state.night]
  const owners = state.owners.map((o, i) => {
    // Back to the start of their round, so nobody waits at the window to catch the jelly again.
    const fresh = newOwner(def.owners[i], props)
    return { ...fresh, alert: o.alert, memory: keepLoot ? o.memory.filter((m) => !m.player) : freshMemory(props) }
  })
  return { ...state, phase: 'play', tickle: null, props, owners, player: { ...newPlayer(), belly }, grace: 3 }
}
