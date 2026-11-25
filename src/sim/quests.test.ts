import { describe, expect, it } from 'vitest'
import { newSave, parseSave } from './meta'
import { ALL_DONE_BONUS, applyNight, claimBonus, claimQuest, ensureQuests, emptyQuests, parseQuests, questsFor, QUESTS, rerollQuest, type NightStats, type QuestState } from './quests'

const night = (patch: Partial<NightStats> = {}): NightStats => ({
  won: false,
  noAlarm: false,
  stars: 0,
  gold: 0,
  difficulty: 'orta',
  loot: 0,
  swaps: 0,
  catScared: 0,
  tickles: 0,
  kinds: 0,
  eyesClosedSec: 0,
  ...patch,
})

const fixed = (ids: QuestState['list'][number]['id'][]): QuestState => ({
  day: '2026-11-23',
  list: ids.map((id) => ({ id, progress: 0, claimed: false })),
  rerolled: false,
  bonusClaimed: false,
})

describe('daily quests', () => {
  it('picks three different quests, the same for everyone on a day, new ones the next day', () => {
    const a = questsFor('2026-11-23')
    expect(new Set(a).size).toBe(3)
    expect(questsFor('2026-11-23')).toEqual(a)
    const days = ['2026-11-24', '2026-11-25', '2026-11-26'].map((d) => questsFor(d).join())
    expect(days.some((d) => d !== a.join())).toBe(true)
  })

  it('a new day replaces old quests; the same day keeps progress', () => {
    const q = ensureQuests(emptyQuests(), '2026-11-23')
    const progressed = { ...q, list: q.list.map((x) => ({ ...x, progress: 1 })) }
    expect(ensureQuests(progressed, '2026-11-23')).toBe(progressed)
    expect(ensureQuests(progressed, '2026-11-24').list.every((x) => x.progress === 0)).toBe(true)
  })

  it('nights add progress up to the target and report what just finished', () => {
    const q = fixed(['takas', 'gece', 'alarmsiz'])
    const r1 = applyNight(q, night({ swaps: 1, won: true }))
    expect(r1.quests.list.map((x) => x.progress)).toEqual([1, 1, 0])
    expect(r1.finished).toEqual([])
    const r2 = applyNight(r1.quests, night({ swaps: 5, won: true, noAlarm: true }))
    expect(r2.quests.list.map((x) => x.progress)).toEqual([2, 2, 1])
    expect(r2.finished).toEqual(['takas', 'alarmsiz'])
  })

  it('a lost night still counts event quests but not win quests', () => {
    const r = applyNight(fixed(['kedi', 'gece', 'yildiz']), night({ catScared: 1, won: false, stars: 3 }))
    expect(r.quests.list.map((x) => x.progress)).toEqual([1, 0, 0])
  })

  it('rewards are claimed once, doubled by the ad, and all three give a bonus', () => {
    let q = applyNight(fixed(['kedi', 'zor', 'gece']), night({ catScared: 1, won: true, difficulty: 'zor' })).quests
    q = applyNight(q, night({ won: true })).quests
    q = applyNight(q, night({ won: true })).quests
    const c0 = claimQuest(q, 0, 2)
    expect(c0?.coins).toBe(QUESTS.kedi.reward * 2)
    q = c0?.quests ?? q
    expect(claimQuest(q, 0)).toBeNull()
    expect(claimBonus(q)).toBeNull()
    q = claimQuest(q, 1)?.quests ?? q
    q = claimQuest(q, 2)?.quests ?? q
    expect(claimBonus(q)?.coins).toBe(ALL_DONE_BONUS)
    expect(claimBonus(claimBonus(q)?.quests ?? q)).toBeNull()
  })

  it('an unfinished quest can be swapped once a day for one not already listed', () => {
    const q = fixed(['takas', 'kedi', 'gece'])
    const r = rerollQuest(q, 1, 3)
    expect(r?.list[1].id).not.toBe('kedi')
    expect(['takas', 'gece']).not.toContain(r?.list[1].id)
    expect(rerollQuest(r as QuestState, 0, 1)).toBeNull()
  })

  it('stored quests survive a reload and junk is dropped', () => {
    expect(parseQuests(null)).toEqual(emptyQuests())
    const p = parseQuests({ day: 'x', list: [{ id: 'takas', progress: 99, claimed: true }, { id: 'hack', progress: 1 }] })
    expect(p.list).toEqual([{ id: 'takas', progress: 2, claimed: true }])
    const s = parseSave({ ...newSave(), quests: fixed(['kedi', 'gece', 'zor']) })
    expect(s.quests.list.map((x) => x.id)).toEqual(['kedi', 'gece', 'zor'])
  })
})
