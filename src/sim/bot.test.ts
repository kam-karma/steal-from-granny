import { describe, expect, it } from 'vitest'
import { botInput, newBot } from './bot'
import { PROP_DEFS } from './catalog'
import { makeRules, type Difficulty } from './config'
import { continueAfterCaught, createGame, stepGame } from './game'
import { navGrid } from './geom'
import { EXIT, SPAWN } from './layout'
import { findPath } from './nav'
import { NIGHTS } from './nights'
import type { GameState } from './types'

const DT = 1 / 60

describe('every night can be finished', () => {
  it('every target and bonus can be reached from the window, and back', () => {
    NIGHTS.forEach((_, n) => {
      const s = createGame(1, n)
      for (const id of [...s.targets, ...s.bonus]) {
        const circles = s.props.filter((q) => q.id !== id && q.present && PROP_DEFS[q.kind].size !== 'XS').map((q) => ({ pos: q.pos, r: PROP_DEFS[q.kind].radius }))
        expect(findPath(navGrid(), SPAWN, s.props[id].pos, circles, 0.42), `night ${n} ${s.props[id].kind}`).not.toBeNull()
        expect(findPath(navGrid(), s.props[id].pos, { x: EXIT.x, z: EXIT.z }, circles, 0.42)).not.toBeNull()
      }
    })
  })
})

interface Run {
  readonly won: boolean
  readonly caught: number
  readonly time: number
  readonly stars: number
}

/** Let the careful bot play a night; being caught costs the loot (no ad), up to 3 times. */
export function playNight(night: number, d: Difficulty, seed: number, limit = 300): Run {
  let s: GameState = createGame(seed, night, makeRules(d), 'puf')
  let bot = newBot()
  let caught = 0
  for (let t = 0; t < limit; t += DT) {
    const r = botInput(bot, s, DT)
    bot = r.bot
    s = stepGame(s, r.input, DT).state
    if (s.phase === 'won') return { won: true, caught, time: t, stars: s.result?.stars.filter(Boolean).length ?? 0 }
    if (s.phase === 'caught') {
      caught++
      if (caught > 3) break
      s = continueAfterCaught(s, false)
      bot = newBot()
    }
  }
  return { won: false, caught, time: limit, stars: 0 }
}

describe('a careful player', () => {
  it('can win the first night on Kolay', () => {
    const r = playNight(0, 'kolay', 11)
    expect(r.won).toBe(true)
  })
})
