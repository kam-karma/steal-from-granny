import { describe, expect, it } from 'vitest'
import { makeRules } from './config'
import { addToAlbum, bankNight, buySkin, buyUpgrade, dailyReward, newSave, nightUnlocked, parseSave, STAR_BONUS } from './meta'

describe('save and progression', () => {
  it('banks gold, new stars only once, and trophies', () => {
    const s = newSave()
    const first = bankNight(s, 0, { loot: ['vazo'], gold: 130, stars: [true, false, true] })
    expect(first.coins).toBe(130 + 2 * STAR_BONUS)
    expect(first.save.stars[0]).toBe(2)
    expect(first.save.trophies.vazo).toBe(1)
    const again = bankNight(first.save, 0, { loot: ['vazo'], gold: 130, stars: [true, false, true] })
    expect(again.coins).toBe(130)
  })

  it('the ad multiplier multiplies the loot gold, not the star bonus', () => {
    const r = bankNight(newSave(), 0, { loot: ['vazo'], gold: 100, stars: [true, false, false] }, 3)
    expect(r.coins).toBe(300 + STAR_BONUS)
  })

  it('a night opens once the one before has a star', () => {
    const s = newSave()
    expect(nightUnlocked(s, 0)).toBe(true)
    expect(nightUnlocked(s, 1)).toBe(false)
    expect(nightUnlocked({ ...s, stars: [1, 0, 0, 0, 0, 0] }, 1)).toBe(true)
  })

  it('the album pays for each new disguise once', () => {
    const a = addToAlbum(newSave(), ['saksi', 'saksi', 'puf'])
    expect(a.newKinds).toEqual(['saksi', 'puf'])
    expect(addToAlbum(a.save, ['saksi']).coins).toBe(0)
  })

  it('upgrades cost coins, cap at level 3, and change the rules', () => {
    let s = { ...newSave(), coins: 10000 }
    for (let k = 0; k < 3; k++) s = buyUpgrade(s, 'karin') ?? s
    expect(s.upgrades.karin).toBe(3)
    expect(buyUpgrade(s, 'karin')).toBeNull()
    expect(makeRules('orta', s.upgrades).bellyMax).toBe(7)
    expect(buyUpgrade(newSave(), 'hiz')).toBeNull()
  })

  it('skins are bought once and then just worn', () => {
    const rich = { ...newSave(), coins: 500 }
    const bought = buySkin(rich, 'cilek')
    expect(bought?.coins).toBe(380)
    expect(bought?.skin).toBe('cilek')
    expect(buySkin({ ...(bought as ReturnType<typeof newSave>), skin: 'nane' }, 'cilek')?.coins).toBe(380)
  })

  it('the daily jar pays once a day and grows with a streak', () => {
    const d1 = dailyReward(newSave(), '2026-11-23')
    expect(d1?.coins).toBe(50)
    expect(dailyReward(d1?.save ?? newSave(), '2026-11-23')).toBeNull()
    const d2 = dailyReward(d1?.save ?? newSave(), '2026-11-24')
    expect(d2?.coins).toBe(70)
    const gap = dailyReward(d2?.save ?? newSave(), '2026-11-27')
    expect(gap?.coins).toBe(50)
  })

  it('a broken or old save never crashes the game', () => {
    expect(parseSave(null)).toEqual(newSave())
    const p = parseSave({ coins: -5, stars: [3, 9, 'x'], skins: ['hacker'], skin: 'hacker', difficulty: 'nightmare', upgrades: { karin: 99 } })
    expect(p.coins).toBe(0)
    expect(p.stars.slice(0, 3)).toEqual([3, 3, 0])
    expect(p.skin).toBe('nane')
    expect(p.difficulty).toBe('orta')
    expect(p.upgrades.karin).toBe(3)
    const evil = parseSave({ skins: ['toString'], album: ['constructor'], trophies: { vazo: 2, toString: 1, kupa: 'x' }, quests: { day: 'd', list: [{ id: 'toString', progress: 1 }] } })
    expect(evil.skins).toEqual(['nane'])
    expect(evil.album).toEqual([])
    expect(evil.trophies).toEqual({ vazo: 2 })
    expect(evil.quests.list).toEqual([])
  })
})
