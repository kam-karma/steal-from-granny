import type { Difficulty } from './config'
import { rngFrom } from './rng'

/** What one night produced, counted from game events and the result. */
export interface NightStats {
  readonly won: boolean
  readonly noAlarm: boolean
  readonly stars: number
  readonly gold: number
  readonly difficulty: Difficulty
  readonly loot: number
  readonly swaps: number
  readonly catScared: number
  readonly tickles: number
  readonly kinds: number
  readonly eyesClosedSec: number
}

export type QuestId = 'takas' | 'kedi' | 'gidik' | 'kilik' | 'ganimet' | 'alarmsiz' | 'altin' | 'yildiz' | 'gece' | 'zor' | 'kor'

export interface QuestDef {
  /** Name of its drawn icon in public/ui/icons. */
  readonly icon: string
  readonly text: string
  readonly target: number
  readonly reward: number
  /** How much this night adds to the quest. */
  readonly count: (s: NightStats) => number
}

export const QUESTS: Record<QuestId, QuestDef> = {
  takas: { icon: 'swap', text: '2 kez takas yap (boşluğa eşya tükür)', target: 2, reward: 80, count: (s) => s.swaps },
  kedi: { icon: 'salatalik', text: 'Kediyi salatalıkla korkut', target: 1, reward: 70, count: (s) => s.catScared },
  gidik: { icon: 'feather', text: 'Gıdıklanmaya 2 kez dayan', target: 2, reward: 90, count: (s) => s.tickles },
  kilik: { icon: 'masks', text: '10 farklı kılığa gir', target: 10, reward: 60, count: (s) => s.kinds },
  ganimet: { icon: 'moneybag', text: '8 ganimet yut', target: 8, reward: 80, count: (s) => s.loot },
  alarmsiz: { icon: 'shush', text: 'Bir geceyi alarm çalmadan bitir', target: 1, reward: 100, count: (s) => (s.won && s.noAlarm ? 1 : 0) },
  altin: { icon: 'coin', text: 'Tek gecede 200 altın kazan', target: 1, reward: 90, count: (s) => (s.won && s.gold >= 200 ? 1 : 0) },
  yildiz: { icon: 'star', text: '5 yıldız topla', target: 5, reward: 90, count: (s) => (s.won ? s.stars : 0) },
  gece: { icon: 'moon', text: '3 gece bitir', target: 3, reward: 70, count: (s) => (s.won ? 1 : 0) },
  zor: { icon: 'flame', text: 'Zor modda bir gece bitir', target: 1, reward: 150, count: (s) => (s.won && s.difficulty === 'zor' ? 1 : 0) },
  kor: { icon: 'hide', text: 'Toplam 30 saniye gözlerin kapalı bekle', target: 30, reward: 60, count: (s) => Math.floor(s.eyesClosedSec) },
}

export const QUEST_IDS = Object.keys(QUESTS) as QuestId[]

/** Today as YYYY-MM-DD in the player's own time zone. */
export const localDay = (d: Date = new Date()): string => d.toLocaleDateString('sv-SE')
export const DAILY_COUNT = 3
export const ALL_DONE_BONUS = 150

export interface Quest {
  readonly id: QuestId
  readonly progress: number
  readonly claimed: boolean
}

export interface QuestState {
  readonly day: string
  readonly list: readonly Quest[]
  readonly rerolled: boolean
  readonly bonusClaimed: boolean
}

export const emptyQuests = (): QuestState => ({ day: '', list: [], rerolled: false, bonusClaimed: false })

function seedOf(day: string): number {
  let h = 2166136261
  for (let k = 0; k < day.length; k++) h = Math.imul(h ^ day.charCodeAt(k), 16777619)
  return h >>> 0
}

/** The same three quests for everyone on a given day. */
export function questsFor(day: string): QuestId[] {
  const rnd = rngFrom(seedOf(day))
  const pool = [...QUEST_IDS]
  const out: QuestId[] = []
  while (out.length < DAILY_COUNT) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0])
  return out
}

/** Today's quests; a new day replaces yesterday's. */
export function ensureQuests(q: QuestState, day: string): QuestState {
  if (q.day === day && q.list.length === DAILY_COUNT) return q
  return { day, list: questsFor(day).map((id) => ({ id, progress: 0, claimed: false })), rerolled: false, bonusClaimed: false }
}

export const isDone = (q: Quest): boolean => q.progress >= QUESTS[q.id].target

/** Add one night's stats; returns the new state and the quests that just got finished. */
export function applyNight(q: QuestState, s: NightStats): { quests: QuestState; finished: QuestId[] } {
  const finished: QuestId[] = []
  const list = q.list.map((x) => {
    if (x.claimed || isDone(x)) return x
    const progress = Math.min(QUESTS[x.id].target, x.progress + Math.max(0, QUESTS[x.id].count(s)))
    const next = { ...x, progress }
    if (isDone(next)) finished.push(x.id)
    return next
  })
  return { quests: { ...q, list }, finished }
}

/** Take a finished quest's reward (mult = 2 after the rewarded ad). */
export function claimQuest(q: QuestState, i: number, mult = 1): { quests: QuestState; coins: number } | null {
  const x = q.list[i]
  if (x === undefined || x.claimed || !isDone(x)) return null
  return { quests: { ...q, list: q.list.map((y, k) => (k === i ? { ...y, claimed: true } : y)) }, coins: QUESTS[x.id].reward * mult }
}

export function claimBonus(q: QuestState): { quests: QuestState; coins: number } | null {
  if (q.bonusClaimed || q.list.length === 0 || !q.list.every((x) => x.claimed)) return null
  return { quests: { ...q, bonusClaimed: true }, coins: ALL_DONE_BONUS }
}

/** Swap one unfinished quest for another (once a day, after a rewarded ad). */
export function rerollQuest(q: QuestState, i: number, pick: number): QuestState | null {
  const x = q.list[i]
  if (q.rerolled || x === undefined || x.claimed || isDone(x)) return null
  const free = QUEST_IDS.filter((id) => !q.list.some((y) => y.id === id))
  if (free.length === 0) return null
  const id = free[Math.abs(Math.floor(pick)) % free.length]
  return { ...q, rerolled: true, list: q.list.map((y, k) => (k === i ? { id, progress: 0, claimed: false } : y)) }
}

/** Accept a stored quest state, dropping anything that does not fit. */
export function parseQuests(raw: unknown): QuestState {
  if (typeof raw !== 'object' || raw === null) return emptyQuests()
  const r = raw as Partial<QuestState>
  const list = Array.isArray(r.list)
    ? r.list
        .filter((x): x is Quest => typeof x === 'object' && x !== null && Object.hasOwn(QUESTS, (x as Quest).id))
        .map((x) => ({ id: x.id, progress: Math.max(0, Math.min(QUESTS[x.id].target, Number(x.progress) || 0)), claimed: x.claimed === true }))
    : []
  return { day: typeof r.day === 'string' ? r.day : '', list, rerolled: r.rerolled === true, bonusClaimed: r.bonusClaimed === true }
}
