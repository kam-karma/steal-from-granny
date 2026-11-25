import { PROP_DEFS, type PropKind } from './catalog'
import { NO_UPGRADES, type Difficulty, type UpgradeId, type Upgrades } from './config'
import { NIGHTS } from './nights'
import { emptyQuests, parseQuests, type QuestState } from './quests'
import type { Result } from './types'

/** Everything that survives between nights (kept in localStorage by the page). */
export interface Save {
  readonly coins: number
  readonly stars: readonly number[]
  readonly upgrades: Upgrades
  readonly skins: readonly SkinId[]
  readonly skin: SkinId
  readonly album: readonly PropKind[]
  readonly trophies: Readonly<Partial<Record<PropKind, number>>>
  readonly difficulty: Difficulty
  readonly daily: { readonly last: string; readonly streak: number }
  readonly quests: QuestState
  /** How often each disguise was used, so the owners can learn the jelly's favourite. */
  readonly habits: Readonly<Partial<Record<PropKind, number>>>
}

export type SkinId = 'nane' | 'cilek' | 'yabanmersini' | 'limon' | 'uzum' | 'portakal' | 'altin' | 'gokkusagi'

export interface Skin {
  readonly name: string
  readonly color: number
  readonly emissive: number
  readonly price: number
}

export const SKINS: Record<SkinId, Skin> = {
  nane: { name: 'Nane', color: 0x2fe08f, emissive: 0x0a7a4c, price: 0 },
  cilek: { name: 'Çilek', color: 0xff5c8a, emissive: 0x9a1840, price: 120 },
  yabanmersini: { name: 'Yaban Mersini', color: 0x4f7dff, emissive: 0x1a2f9a, price: 160 },
  limon: { name: 'Limon', color: 0xffe14d, emissive: 0x9a7a00, price: 200 },
  portakal: { name: 'Portakal', color: 0xff9a2e, emissive: 0x9a4a00, price: 250 },
  uzum: { name: 'Üzüm', color: 0xa45cff, emissive: 0x4a1a9a, price: 320 },
  altin: { name: 'Altın', color: 0xffcc33, emissive: 0xc07a00, price: 900 },
  gokkusagi: { name: 'Gökkuşağı', color: 0xffffff, emissive: 0x555555, price: 1500 },
}

export interface UpgradeDef {
  readonly name: string
  /** Name of its drawn icon in public/ui/icons. */
  readonly icon: string
  readonly what: string
  readonly prices: readonly number[]
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  hiz: { name: 'Hızlı Jöle', icon: 'speed', what: 'Jöle hâlinde %8 daha hızlı', prices: [60, 150, 320] },
  donma: { name: 'Donma Ustası', icon: 'ice', what: 'Bakarken kıpırdarsan %12 daha geç fark edilirsin', prices: [80, 200, 400] },
  karin: { name: 'Büyük Karın', icon: 'belly', what: 'Karnına +1 eşya sığar', prices: [100, 250, 500] },
  gidik: { name: 'Gıdık Direnci', icon: 'feather', what: 'Gıdıklama halkası daha geniş', prices: [50, 130, 280] },
  bukalemun: { name: 'Bukalemun', icon: 'chameleon', what: 'Yanlış odadaki kılık daha az şüphe çeker', prices: [90, 220, 450] },
}

export const MAX_LEVEL = 3

export function newSave(): Save {
  return {
    coins: 0,
    stars: NIGHTS.map(() => 0),
    upgrades: NO_UPGRADES,
    skins: ['nane'],
    skin: 'nane',
    album: [],
    trophies: {},
    difficulty: 'orta',
    daily: { last: '', streak: 0 },
    quests: emptyQuests(),
    habits: {},
  }
}

/** Keep only { kind: non-negative finite number } pairs. */
function countsOnly(raw: unknown): Partial<Record<PropKind, number>> {
  if (typeof raw !== 'object' || raw === null) return {}
  return Object.fromEntries(
    Object.entries(raw).filter(([k, n]) => Object.hasOwn(PROP_DEFS, k) && typeof n === 'number' && Number.isFinite(n) && n >= 0),
  ) as Partial<Record<PropKind, number>>
}

/** Accept anything that looks like a save; fill gaps from a new one. */
export function parseSave(raw: unknown): Save {
  const base = newSave()
  if (typeof raw !== 'object' || raw === null) return base
  const r = raw as Partial<Save>
  const num = (x: unknown, d: number): number => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : d)
  const skins = Array.isArray(r.skins) ? r.skins.filter((s): s is SkinId => typeof s === 'string' && Object.hasOwn(SKINS, s)) : base.skins
  return {
    coins: Math.floor(num(r.coins, 0)),
    stars: NIGHTS.map((_, i) => Math.min(3, Math.floor(num(Array.isArray(r.stars) ? r.stars[i] : 0, 0)))),
    upgrades: Object.fromEntries(
      (Object.keys(NO_UPGRADES) as UpgradeId[]).map((k) => [k, Math.min(MAX_LEVEL, Math.floor(num(r.upgrades?.[k], 0)))]),
    ) as unknown as Upgrades,
    skins: skins.includes('nane') ? skins : ['nane', ...skins],
    skin: r.skin !== undefined && skins.includes(r.skin) ? r.skin : 'nane',
    album: Array.isArray(r.album) ? r.album.filter((k): k is PropKind => typeof k === 'string' && Object.hasOwn(PROP_DEFS, k)) : [],
    trophies: countsOnly(r.trophies),
    difficulty: r.difficulty === 'kolay' || r.difficulty === 'zor' ? r.difficulty : 'orta',
    daily: { last: typeof r.daily?.last === 'string' ? r.daily.last : '', streak: Math.floor(num(r.daily?.streak, 0)) },
    quests: parseQuests(r.quests),
    habits: typeof r.habits === 'object' && r.habits !== null ? countsOnly(r.habits) : {},
  }
}

export const nightUnlocked = (s: Save, night: number): boolean => night === 0 || s.stars[night - 1] > 0
export const totalStars = (s: Save): number => s.stars.reduce((a, b) => a + b, 0)

export const STAR_BONUS = 20
export const ALBUM_COIN = 5

export interface Reward {
  readonly save: Save
  readonly coins: number
  readonly newKinds: readonly PropKind[]
}

/** Bank a finished night: loot gold, star bonus for new stars, trophies. */
export function bankNight(s: Save, night: number, r: Result, mult = 1): Reward {
  const got = r.stars.filter(Boolean).length
  const newStars = Math.max(0, got - s.stars[night])
  const coins = r.gold * mult + newStars * STAR_BONUS
  const trophies = { ...s.trophies }
  for (const k of r.loot) trophies[k] = (trophies[k] ?? 0) + 1
  return {
    save: { ...s, coins: s.coins + coins, stars: s.stars.map((v, i) => (i === night ? Math.max(v, got) : v)), trophies },
    coins,
    newKinds: [],
  }
}

/** Record disguises seen in play; each new kind pays a little. */
export function addToAlbum(s: Save, kinds: readonly PropKind[]): Reward {
  const newKinds = [...new Set(kinds)].filter((k) => !s.album.includes(k))
  const coins = newKinds.length * ALBUM_COIN
  return { save: { ...s, album: [...s.album, ...newKinds], coins: s.coins + coins }, coins, newKinds }
}

export function upgradePrice(s: Save, id: UpgradeId): number | null {
  const lvl = s.upgrades[id]
  return lvl >= MAX_LEVEL ? null : UPGRADES[id].prices[lvl]
}

export function buyUpgrade(s: Save, id: UpgradeId): Save | null {
  const price = upgradePrice(s, id)
  if (price === null || s.coins < price) return null
  return { ...s, coins: s.coins - price, upgrades: { ...s.upgrades, [id]: s.upgrades[id] + 1 } }
}

export function buySkin(s: Save, id: SkinId): Save | null {
  if (s.skins.includes(id)) return { ...s, skin: id }
  const price = SKINS[id].price
  if (s.coins < price) return null
  return { ...s, coins: s.coins - price, skins: [...s.skins, id], skin: id }
}

const dayDiff = (a: string, b: string): number => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)

/** Daily jar: coins once a day, more for a streak of days in a row (up to 7). */
export function dailyReward(s: Save, today: string): { save: Save; coins: number } | null {
  if (s.daily.last === today) return null
  const streak = s.daily.last !== '' && dayDiff(s.daily.last, today) === 1 ? Math.min(7, s.daily.streak + 1) : 1
  const coins = 30 + streak * 20
  return { save: { ...s, coins: s.coins + coins, daily: { last: today, streak } }, coins }
}

/** Add this night's disguise use. */
export function addHabits(s: Save, uses: Readonly<Partial<Record<PropKind, number>>>): Save {
  const habits: Partial<Record<PropKind, number>> = { ...s.habits }
  for (const [k, n] of Object.entries(uses) as Array<[PropKind, number]>) habits[k] = (habits[k] ?? 0) + n
  return { ...s, habits }
}

/** The disguise used most, if any was used at least 3 times. */
export function favourite(s: Save): PropKind | null {
  const best = (Object.entries(s.habits) as Array<[PropKind, number]>).sort((a, b) => b[1] - a[1])[0]
  return best !== undefined && best[1] >= 3 ? best[0] : null
}

export const ALBUM_KINDS = Object.keys(PROP_DEFS) as PropKind[]
export const LOOT_KINDS = ALBUM_KINDS.filter((k) => PROP_DEFS[k].value > 0)
