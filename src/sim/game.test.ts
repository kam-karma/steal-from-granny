import { describe, expect, it } from 'vitest'
import { PROP_DEFS } from './catalog'
import { makeRules } from './config'
import { collide, hasLOS, routeTo, walkRoute } from './geom'
import { continueAfterCaught, createGame, stepGame } from './game'
import { DOORS, EXIT, roomAt, ROOMS } from './layout'
import { NIGHTS } from './nights'
import type { Cat, GameEvent, GameState, Owner, Player, PlayerInput, PropKind, Vec } from './types'

const DT = 1 / 60
const idle: PlayerInput = { move: { x: 0, z: 0 }, interact: false, eyes: false, spit: false }

function run(s: GameState, input: PlayerInput, seconds: number): { state: GameState; events: GameEvent[] } {
  let st = s
  const events: GameEvent[] = []
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    const r = stepGame(st, input, DT)
    st = r.state
    events.push(...r.events)
  }
  return { state: st, events }
}

/** One owner standing still at pos, staring at one angle. */
function owner(s: GameState, pos: Vec, face: number, patch: Partial<Owner> = {}): GameState {
  const o = { ...s.owners[0], pos, face, mode: 'wait' as const, timer: 1e9, hold: 1e9, sweep: [face], ...patch }
  return { ...s, owners: [o], grace: 0 }
}

/** An owner who sees nothing: in the bedroom corner staring at the wall. */
const blindOwner = (s: GameState): GameState => owner(s, { x: 16.4, z: -1.0 }, 0)

const withCat = (s: GameState, c: Partial<Cat>): GameState => ({ ...s, cat: { ...(createGame(1, 1).cat as Cat), ...c } })

function player(s: GameState, patch: Partial<Player>): GameState {
  return { ...s, player: { ...s.player, ...patch } }
}

const propOf = (s: GameState, kind: PropKind, n = 0) => s.props.filter((p) => p.kind === kind)[n]
const near = (s: GameState, kind: PropKind, x: number, z: number) =>
  s.props.filter((p) => p.kind === kind).sort((a, b) => Math.hypot(a.pos.x - x, a.pos.z - z) - Math.hypot(b.pos.x - x, b.pos.z - z))[0]

const base = (): GameState => blindOwner(createGame(3, 0))

function swallow(s: GameState): GameState {
  return run(run(s, { ...idle, interact: true }, 1.1).state, idle, DT).state
}

describe('house', () => {
  it('every door joins two different rooms and every room has a door', () => {
    for (const d of DOORS) expect(d.a).not.toBe(d.b)
    ROOMS.forEach((_, i) => expect(DOORS.some((d) => d.a === i || d.b === i)).toBe(true))
  })
  it('every thing starts in a free spot inside a room', () => {
    for (const p of createGame().props) {
      const free = collide(p.pos, 0.05)
      expect(Math.hypot(free.x - p.pos.x, free.z - p.pos.z), `${p.kind} at ${p.pos.x},${p.pos.z}`).toBeLessThan(0.05)
    }
  })
  it('walls block sight except through the doors', () => {
    expect(hasLOS({ x: -1, z: -3 }, { x: -8, z: -8 })).toBe(false)
    expect(hasLOS({ x: -3, z: -4.5 }, { x: -9, z: -4.5 })).toBe(true)
  })
  it('a wardrobe hides what is behind it', () => {
    expect(hasLOS({ x: 14, z: -6 }, { x: 16.95, z: -6 })).toBe(false)
  })
  it('routes go through doors between far rooms', () => {
    const r = routeTo({ x: -12, z: -8 }, { x: 13, z: 6 })
    expect(r.length).toBeGreaterThan(2)
    expect(roomAt(r[r.length - 1])).toBe(6)
  })
  it('a walker blocked head-on by a table gets around it', () => {
    let pos: Vec = { x: -11.5, z: -7.4 }
    let route: readonly Vec[] = [{ x: -11.5, z: -2.2 }]
    for (let k = 0; k < 900 && route.length > 0; k++) {
      const w = walkRoute(pos, route, 2, DT, 0.4)
      pos = w.pos
      route = w.route
    }
    expect(pos.z).toBeGreaterThan(-3)
  })
})

describe('patrol', () => {
  it('every night: the owners walk their whole rounds without getting stuck', () => {
    NIGHTS.forEach((night, n) => {
      let s = player(createGame(5, n), { pos: { x: -16.2, z: 10.4 }, form: 'kova', eyesClosed: true })
      const seen = night.owners.map(() => new Set<number>())
      for (let t = 0; t < 200; t += DT) {
        s = stepGame(s, { ...idle, eyes: true }, DT).state
        s.owners.forEach((o, i) => {
          if (o.mode === 'wait') seen[i].add(o.wp)
        })
      }
      night.owners.forEach((o, i) => expect(seen[i].size, `night ${n} owner ${i}`).toBe(o.patrol.length))
    })
    // 200 simulated seconds on 6 nights: well under a second normally, but slow under coverage or on a CI runner.
  }, 30_000)
})

describe('copy and swallow', () => {
  it('a short tap copies the nearest thing', () => {
    const pot = near(createGame(), 'saksi', -6.8, -0.9)
    let s = player(base(), { pos: { x: pot.pos.x - 0.9, z: pot.pos.z } })
    s = run(s, { ...idle, interact: true }, 0.15).state
    expect(run(s, idle, DT).state.player.form).toBe('saksi')
  })

  it('a tap with nothing near turns back into jelly', () => {
    let s = player(base(), { pos: { x: -1, z: -2 }, form: 'puf' })
    s = run(s, { ...idle, interact: true }, 0.1).state
    expect(run(s, idle, DT).state.player.form).toBeNull()
  })

  it('holding swallows: stolen, and the jelly stands in its place in its shape', () => {
    const vase = propOf(createGame(), 'vazo')
    const s = swallow(player(base(), { pos: { x: vase.pos.x - 0.9, z: vase.pos.z } }))
    expect(s.props.find((p) => p.id === vase.id)?.present).toBe(false)
    expect(s.player.belly).toContain(vase.id)
    expect(s.player.form).toBe('vazo')
    expect(s.player.pos).toEqual(vase.pos)
  })

  it('loot under a plant is swallowed before the plant', () => {
    const ring = propOf(createGame(), 'yuzuk')
    const s = swallow(player(base(), { pos: { x: -4.9, z: -7.2 }, form: 'kova' }))
    expect(s.player.belly).toEqual([ring.id])
    expect(s.player.form).toBe('kova')
  })

  it('a full belly refuses more; the Büyük Karın upgrade makes room', () => {
    const at = { x: 4.2, z: 3.2 }
    const full = player(base(), { pos: at, belly: [0, 1, 2, 3] })
    expect(run(full, { ...idle, interact: true }, 1).events.some((e) => e.type === 'full')).toBe(true)
    const big = { ...full, rules: makeRules('orta', { hiz: 0, donma: 0, karin: 1, gidik: 0, bukalemun: 0 }) }
    expect(swallow(big).player.belly.length).toBe(5)
  })
})

describe('statue rule and difficulty', () => {
  const scene = (d: 'kolay' | 'orta' | 'zor'): GameState =>
    player(owner({ ...createGame(1, 0), rules: makeRules(d) }, { x: -1, z: -3 }, 0), { pos: { x: 3.2, z: -3 }, form: 'puf', eyesClosed: true })

  it('standing still in a fitting disguise is safe; moving while she looks is not', () => {
    const s = run(scene('orta'), { ...idle, eyes: true }, 2).state
    expect(s.owners[0].mode).not.toBe('alarm')
    expect(s.owners[0].suspicion).toBeLessThan(40)
    expect(run(s, { ...idle, eyes: true, move: { x: 0, z: 1 } }, 0.7).state.owners[0].mode).toBe('alarm')
  })

  it('Kolay gives more time than Zor before the alarm', () => {
    const timeToAlarm = (d: 'kolay' | 'zor'): number => {
      let s = run(scene(d), { ...idle, eyes: true }, 1).state
      for (let t = 0; t < 5; t += DT) {
        s = stepGame(s, { ...idle, eyes: true, move: { x: 0, z: 0.3 } }, DT).state
        if (s.owners[0].mode === 'alarm') return t
      }
      return 99
    }
    expect(timeToAlarm('kolay')).toBeGreaterThan(timeToAlarm('zor') + 0.2)
  })

  it('a bare jelly in view is spotted within a second or so', () => {
    const s = player(owner(createGame(), { x: -1, z: -3 }, 0), { pos: { x: 3, z: -3 } })
    expect(run(s, idle, 1.3).state.owners[0].mode).toBe('alarm')
  })

  it('walls hide you', () => {
    const s = player(owner(createGame(), { x: -1, z: -3 }, Math.PI), { pos: { x: -8, z: -8 } })
    expect(run(s, idle, 1).state.owners[0].suspicion).toBe(0)
  })

  it('a disguise in the wrong room is more suspicious', () => {
    const at = { x: 3.2, z: -3 }
    const s = owner(createGame(), { x: -1, z: -3 }, 0)
    const fits = run(player(s, { pos: at, form: 'puf', eyesClosed: true }), { ...idle, eyes: true }, DT).state.owners[0].suspicion
    const odd = run(player(s, { pos: at, form: 'camasir', eyesClosed: true }), { ...idle, eyes: true }, DT).state.owners[0].suspicion
    expect(odd).toBeGreaterThan(fits)
  })
})

describe('spot the difference', () => {
  const look = { x: 10.5, z: -4.2 }
  const toVase = 0.12

  it('she notices the missing vase when she looks at its spot again', () => {
    const vase = propOf(createGame(), 'vazo')
    let s = swallow(player(base(), { pos: { x: vase.pos.x - 0.9, z: vase.pos.z } }))
    s = player(s, { pos: { x: -16, z: 10 } })
    const r = run(owner(s, look, toVase), idle, DT)
    expect(r.state.owners[0].alert).toBe(true)
    expect(r.state.owners[0].mode).toBe('investigate')
    expect(r.events.some((e) => e.type === 'say' && e.line.key === 'treasureGone' && e.line.kind === 'vazo')).toBe(true)
  })

  it('the swap trick: spit a same-size thing into the gap and she notices nothing', () => {
    const pot = near(createGame(), 'saksi', 6.8, -0.9)
    const vase = propOf(createGame(), 'vazo')
    let s = swallow(player(base(), { pos: { x: pot.pos.x + 0.9, z: pot.pos.z } }))
    s = swallow(player(s, { pos: { x: vase.pos.x - 0.9, z: vase.pos.z } }))
    s = player(s, { pos: { x: vase.pos.x - 1.0, z: vase.pos.z } })
    const spat = run(s, { ...idle, spit: true }, DT)
    expect(spat.events).toContainEqual({ type: 'spit', propId: pot.id, filled: true })
    s = player(spat.state, { pos: { x: -16, z: 10 } })
    expect(run(owner(s, look, toVase), idle, 0.5).state.owners[0].suspicion).toBe(0)
  })
})

describe('the cat', () => {
  const catScene = (form: PropKind | null): GameState =>
    withCat(player(blindOwner(createGame(1, 1)), { pos: { x: -2, z: -2 }, form }), { pos: { x: 0.6, z: -2 }, face: Math.PI, mode: 'sit', timer: 10, cooldown: 0 })

  it('pounces on a small disguise and knocks the jelly out of shape', () => {
    const r = run(catScene('kova'), idle, 4)
    expect(r.events.some((e) => e.type === 'pounce')).toBe(true)
    expect(r.state.player.form).toBeNull()
  })

  it('runs away from a cucumber', () => {
    expect(run(catScene('salatalik'), idle, 0.5).events.some((e) => e.type === 'catScared')).toBe(true)
  })

  it('meows at a bare jelly and the owner hears it', () => {
    const r = run(catScene(null), idle, 0.2)
    expect(r.events.some((e) => e.type === 'meow')).toBe(true)
    expect(r.state.owners[0].suspicion).toBeGreaterThan(20)
  })
})

describe('tickle', () => {
  const tickling = (d: 'kolay' | 'orta' = 'orta'): GameState => {
    const s = player({ ...createGame(1, 0), rules: makeRules(d) }, { pos: { x: 1, z: -3 }, form: 'saksi', holdUsed: true })
    return { ...s, owners: [{ ...s.owners[0], pos: { x: 0, z: -3 }, mode: 'tickle', suspicion: 50 }], tickle: { owner: 0, poke: 0, t: 0, misses: 0, judged: false } }
  }

  it('three taps in rhythm fool her', () => {
    let s = tickling()
    for (let k = 0; k < 3; k++) {
      s = run(s, idle, 0.93).state
      s = run(s, { ...idle, interact: true }, DT).state
      s = run(s, idle, 1.25 - 0.93 - DT).state
    }
    s = run(s, idle, 0.05).state
    expect(s.tickle).toBeNull()
    expect(s.owners[0].mode).toBe('lookaround')
    expect(s.owners[0].suspicion).toBe(0)
  })

  it('giggling twice gives you away', () => {
    const r = run(tickling(), idle, 2.6)
    expect(r.state.tickle).toBeNull()
    expect(r.state.owners[0].mode).toBe('alarm')
  })

  it('Kolay forgives a tap a little off the beat', () => {
    const tapAt = (d: 'kolay' | 'orta'): number => {
      let s = run(tickling(d), idle, 0.95 + 0.26).state
      s = run(s, { ...idle, interact: true }, DT).state
      return s.tickle?.misses ?? -1
    }
    expect(tapAt('kolay')).toBe(0)
    expect(tapAt('orta')).toBe(1)
  })
})

describe('winning and getting caught', () => {
  const g = createGame(1, 0)
  const id = (k: PropKind): number => propOf(g, k).id

  it('leaving through the window with the targets wins, with stars and gold', () => {
    const s = player(base(), { pos: { x: EXIT.x, z: EXIT.z }, belly: [id('vazo'), id('kavanoz'), id('yuzuk')] })
    const r = stepGame(s, idle, DT).state
    expect(r.phase).toBe('won')
    expect(r.result?.stars).toEqual([true, true, true])
    expect(r.result?.gold).toBe(Math.round((100 + 25 + 50) * 1.3))
    expect(r.result?.loot).toEqual(['vazo', 'kavanoz', 'yuzuk'])
  })

  it('the window nags without the targets', () => {
    const r = stepGame(player(base(), { pos: { x: EXIT.x, z: EXIT.z } }), idle, DT)
    expect(r.state.phase).toBe('play')
    expect(r.events).toContainEqual({ type: 'needMain' })
  })

  it('each night has its own targets', () => {
    NIGHTS.forEach((n, i) => {
      const s = createGame(1, i)
      expect(s.targets.map((t) => s.props[t].kind)).toEqual(n.targets)
      expect(s.owners.length).toBe(n.owners.length)
      for (const k of [...n.targets, ...n.bonus]) expect(PROP_DEFS[k].value).toBeGreaterThan(0)
    })
  })

  it('alarm and contact means caught; continuing without the ad puts the loot back', () => {
    const vaseId = id('vazo')
    let s = player(createGame(), { pos: { x: 1, z: -3 }, belly: [vaseId] })
    s = { ...s, props: s.props.map((p) => (p.id === vaseId ? { ...p, present: false } : p)) }
    s = { ...s, owners: [{ ...s.owners[0], pos: { x: 0, z: -3 }, mode: 'alarm', suspicion: 100 }] }
    const caught = run(s, idle, 0.3).state
    expect(caught.phase).toBe('caught')
    const plain = continueAfterCaught(caught, false)
    expect(plain.player.belly).toEqual([])
    expect(plain.props.find((p) => p.id === vaseId)?.present).toBe(true)
    const kept = continueAfterCaught(caught, true)
    expect(kept.player.belly).toEqual([vaseId])
    expect(kept.phase).toBe('play')
  })
})

describe('night twists', () => {
  it('the robot vacuum sucks a small disguise out of shape and makes noise', () => {
    let s = blindOwner(createGame(1, 2))
    s = { ...s, cat: null, vacuum: { pos: { x: -0.5, z: 2.2 }, face: 0, route: [], wp: 5, pause: 0 } }
    s = player(s, { pos: { x: 0.2, z: 2.2 }, form: 'kova' })
    const r = run(s, idle, 0.5)
    expect(r.events.some((e) => e.type === 'sucked')).toBe(true)
    expect(r.state.player.form).toBeNull()
    expect(r.state.owners[0].suspicion).toBeGreaterThan(20)
  })

  it('a big disguise is safe from the vacuum', () => {
    let s = blindOwner(createGame(1, 2))
    s = { ...s, cat: null, vacuum: { pos: { x: -0.5, z: 2.2 }, face: 0, route: [], wp: 5, pause: 0 } }
    s = player(s, { pos: { x: 0.2, z: 2.2 }, form: 'puf' })
    expect(run(s, idle, 0.5).events.some((e) => e.type === 'sucked')).toBe(false)
  })

  it('a torch sees far down its beam but not to the side', () => {
    const s = createGame(1, 4)
    const o = s.owners[0]
    expect(o.torch).toBe(true)
    const lit = player(owner(s, { x: -1, z: -4.5 }, 0, { torch: true, fovMul: 0.42, rangeMul: 1.45 }), { pos: { x: 10, z: -4.5 } })
    expect(run(lit, idle, 1.3).state.owners[0].mode).toBe('alarm')
    const side = player(owner(s, { x: -1, z: -3 }, 0, { torch: true, fovMul: 0.42, rangeMul: 1.45 }), { pos: { x: 2, z: -0.4 } })
    expect(run(side, idle, 1.3).state.owners[0].suspicion).toBe(0)
  })

  it('on the last night the owners distrust your favourite disguise', () => {
    const habit = createGame(1, 5, makeRules('orta'), 'puf')
    expect(habit.learned).toBe('puf')
    const scene = (s: GameState): GameState => player(owner({ ...s, cat: null, vacuum: null }, { x: -1, z: -3 }, 0), { pos: { x: 3.2, z: -3 }, form: 'puf', eyesClosed: true })
    const watched = run(scene(habit), { ...idle, eyes: true }, 6).state.owners[0]
    const fresh = run(scene(createGame(1, 5, makeRules('orta'), null)), { ...idle, eyes: true }, 6).state.owners[0]
    expect(watched.suspicion + (watched.mode === 'investigate' || watched.mode === 'tickle' ? 100 : 0)).toBeGreaterThan(fresh.suspicion)
  })
})

describe('getting back in after being caught', () => {
  it('the owner does not wait at the window to catch the jelly again', () => {
    let s = player(createGame(), { pos: { x: -14, z: -3 } })
    s = { ...s, owners: [{ ...s.owners[0], pos: { x: -13, z: -3 }, mode: 'alarm', suspicion: 100 }] }
    const caught = run(s, idle, 0.3).state
    expect(caught.phase).toBe('caught')
    const back = continueAfterCaught(caught, false)
    const after = run(back, idle, 2.5).state
    expect(after.phase).toBe('play')
    expect(after.owners[0].mode).not.toBe('alarm')
  })
})

describe('review fixes', () => {
  it('doing nothing during a tickle is never a pass, even with the widest ring', () => {
    const rules = makeRules('kolay', { hiz: 0, donma: 0, karin: 0, gidik: 3, bukalemun: 0 })
    let s = player({ ...createGame(1, 0), rules }, { pos: { x: 1, z: -3 }, form: 'saksi', holdUsed: true })
    s = { ...s, owners: [{ ...s.owners[0], pos: { x: 0, z: -3 }, mode: 'tickle', suspicion: 50 }], tickle: { owner: 0, poke: 0, t: 0, misses: 0, judged: false } }
    expect(run(s, idle, 4).state.owners[0].mode).toBe('alarm')
  })

  it('with a belly full of loot, a spit brings up loot the night does not need', () => {
    const g = createGame(1, 3)
    const extra = ['mucevher', 'kavanoz', 'ordek', 'kupa'].map((k) => propOf(g, k as PropKind).id)
    let s = player(blindOwner(g), { pos: { x: -1, z: 2 }, belly: extra })
    s = { ...s, props: s.props.map((p) => (extra.includes(p.id) ? { ...p, present: false } : p)), cat: null }
    const r = run(s, { ...idle, spit: true }, DT)
    expect(r.state.player.belly.length).toBe(3)
    expect(r.events.some((e) => e.type === 'spit')).toBe(true)
  })

  it('target loot is never spat out', () => {
    const g = createGame(1, 0)
    const vase = propOf(g, 'vazo').id
    const s = player(blindOwner(g), { pos: { x: -1, z: 2 }, belly: [vase] })
    expect(run(s, { ...idle, spit: true }, DT).state.player.belly).toEqual([vase])
  })
})
