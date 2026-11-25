import type { Rules } from './types'

export const PLAYER = {
  radius: 0.42,
  speedBySize: { XS: 3.6, S: 3.6, M: 3.0, L: 2.3 },
  bellySlow: 0.05,
  copyRange: 1.5,
  swallowRange: 1.35,
  holdToSwallow: 0.55,
  swallowTime: 0.4,
  knockTime: 0.9,
} as const

/** Fixed owner constants; the tunable ones live in Rules. */
export const OWNER = {
  radius: 0.4,
  investigateAt: 40,
  memoryCap: 85,
  newHome: 30,
  newOutOfPlace: 50,
  missing: 25,
  movedProp: 15,
  lostAfter: 3.5,
  searchTime: 4,
  matchDist: 0.75,
  sweepHold: 1.15,
} as const

export const CAT = {
  radius: 0.3,
  walk: 1.4,
  stalk: 1.1,
  flee: 4.5,
  range: 4.5,
  halfFov: 1.3,
  pounceTime: 0.45,
  meowNoise: 30,
  pounceNoise: 45,
} as const

export const TICKLE = {
  pokes: 3,
  pokeTime: 1.25,
  hitAt: 0.95,
  maxMisses: 2,
} as const

export type Difficulty = 'kolay' | 'orta' | 'zor'
export const DIFFICULTY_NAMES: Record<Difficulty, string> = { kolay: 'Kolay', orta: 'Orta', zor: 'Zor' }

export type UpgradeId = 'hiz' | 'donma' | 'karin' | 'gidik' | 'bukalemun'
export type Upgrades = Readonly<Record<UpgradeId, number>>
export const NO_UPGRADES: Upgrades = { hiz: 0, donma: 0, karin: 0, gidik: 0, bukalemun: 0 }

const BASE: Rules = {
  ownerRange: 9,
  halfFov: 0.85,
  ownerTurn: 3.0,
  walk: 1.7,
  curious: 2.3,
  chase: 3.9,
  catchDist: 1.35,
  statueRate: 220,
  blobRate: 85,
  blobNearRate: 110,
  eyesRate: 12,
  eyesDist: 3.2,
  decay: 8,
  memoryMul: 1,
  outOfPlaceMul: 1,
  tickleWindow: 0.2,
  blobSpeed: 4.6,
  bellyMax: 4,
  catWiggle: 0.8,
  coinMul: 1.3,
}

const DIFF: Record<Difficulty, Partial<Rules>> = {
  kolay: {
    ownerRange: 7.5,
    ownerTurn: 2.4,
    walk: 1.5,
    chase: 3.4,
    catchDist: 1.15,
    statueRate: 120,
    blobRate: 55,
    blobNearRate: 70,
    eyesRate: 6,
    decay: 12,
    memoryMul: 0.7,
    tickleWindow: 0.3,
    catWiggle: 1.2,
    coinMul: 1,
  },
  orta: {},
  zor: {
    ownerRange: 10.5,
    ownerTurn: 3.6,
    walk: 1.9,
    chase: 4.2,
    statueRate: 320,
    blobRate: 110,
    blobNearRate: 140,
    eyesRate: 18,
    decay: 5,
    memoryMul: 1.3,
    tickleWindow: 0.14,
    catWiggle: 0.6,
    coinMul: 1.8,
  },
}

/** The rules for one night: difficulty first, then the jelly's upgrades on top. */
export function makeRules(d: Difficulty, up: Upgrades = NO_UPGRADES): Rules {
  const r = { ...BASE, ...DIFF[d] }
  return {
    ...r,
    blobSpeed: r.blobSpeed * (1 + 0.08 * up.hiz),
    statueRate: r.statueRate * (1 - 0.12 * up.donma),
    bellyMax: r.bellyMax + up.karin,
    tickleWindow: r.tickleWindow + 0.04 * up.gidik,
    outOfPlaceMul: r.outOfPlaceMul * (1 - 0.2 * up.bukalemun),
    memoryMul: r.memoryMul * (1 - 0.08 * up.bukalemun),
  }
}
