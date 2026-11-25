import type { PropKind } from './catalog'

export type { PropKind }

export interface Vec {
  readonly x: number
  readonly z: number
}

/** Axis-aligned box on the floor: centre, width along x, depth along z, height. */
export interface Box {
  readonly x: number
  readonly z: number
  readonly w: number
  readonly d: number
  readonly h: number
}

/** XS things can be swallowed but are too small to hide inside. L things can be copied but not swallowed. */
export type Size = 'XS' | 'S' | 'M' | 'L'

export interface PropDef {
  readonly name: string
  readonly size: Size
  readonly homes: readonly number[]
  readonly radius: number
  readonly height: number
  readonly value: number
}

export interface Prop {
  readonly id: number
  readonly kind: PropKind
  readonly pos: Vec
  readonly rot: number
  readonly origin: Vec
  readonly present: boolean
}

export interface Swallow {
  readonly propId: number
  readonly t: number
  readonly from: Vec
}

export interface Player {
  readonly pos: Vec
  readonly face: number
  readonly form: PropKind | null
  readonly formRot: number
  readonly belly: readonly number[]
  readonly eyesClosed: boolean
  readonly holding: boolean
  readonly holdTime: number
  readonly holdUsed: boolean
  readonly swallowing: Swallow | null
  readonly moving: boolean
  readonly knocked: number
}

/** What an owner remembers seeing at a spot: only the size of a thing matters, not exactly what it is. */
export interface MemoryEntry {
  readonly pos: Vec
  readonly size: Size
  readonly propId: number | null
  readonly player: boolean
}

export type OwnerMode = 'patrol' | 'wait' | 'investigate' | 'lookaround' | 'tickle' | 'alarm' | 'search'
export type OwnerKind = 'teyze' | 'dede'

export interface Waypoint {
  readonly x: number
  readonly z: number
  readonly sweep: readonly number[]
  /** Seconds per sweep angle at this stop. */
  readonly hold?: number
}

export interface Owner {
  readonly kind: OwnerKind
  readonly pos: Vec
  readonly face: number
  readonly mode: OwnerMode
  readonly patrol: readonly Waypoint[]
  readonly wp: number
  readonly timer: number
  readonly hold: number
  readonly route: readonly Vec[]
  readonly target: Vec | null
  readonly sweep: readonly number[]
  readonly suspicion: number
  readonly memory: readonly MemoryEntry[]
  readonly lostTimer: number
  readonly alert: boolean
  readonly seesPlayer: boolean
  /** Personal multipliers: Dede is slow and short-sighted; a torch sees far but narrow. */
  readonly speedMul: number
  readonly rangeMul: number
  readonly fovMul: number
  readonly torch: boolean
}

/** The robot vacuum: drives a loop and sucks up small disguises. */
export interface Vacuum {
  readonly pos: Vec
  readonly face: number
  readonly route: readonly Vec[]
  readonly wp: number
  readonly pause: number
}

export type CatMode = 'nap' | 'wander' | 'sit' | 'stalk' | 'wiggle' | 'pounce' | 'scared' | 'sniff' | 'meow'

export interface Cat {
  readonly pos: Vec
  readonly face: number
  readonly mode: CatMode
  readonly timer: number
  readonly route: readonly Vec[]
  readonly from: Vec | null
  readonly target: Vec | null
  readonly cooldown: number
  readonly trips: number
  readonly hop: number
}

export interface Tickle {
  readonly owner: number
  readonly poke: number
  readonly t: number
  readonly misses: number
  readonly judged: boolean
}

export type Phase = 'play' | 'caught' | 'won'

export interface Result {
  readonly loot: readonly PropKind[]
  readonly gold: number
  readonly stars: readonly [boolean, boolean, boolean]
}

/** Every number the difficulty and the upgrades can change. */
export interface Rules {
  readonly ownerRange: number
  readonly halfFov: number
  readonly ownerTurn: number
  readonly walk: number
  readonly curious: number
  readonly chase: number
  readonly catchDist: number
  readonly statueRate: number
  readonly blobRate: number
  readonly blobNearRate: number
  readonly eyesRate: number
  readonly eyesDist: number
  readonly decay: number
  readonly memoryMul: number
  readonly outOfPlaceMul: number
  readonly tickleWindow: number
  readonly blobSpeed: number
  readonly bellyMax: number
  readonly catWiggle: number
  readonly coinMul: number
}

export interface GameState {
  readonly time: number
  readonly seed: number
  readonly phase: Phase
  readonly night: number
  readonly rules: Rules
  readonly player: Player
  readonly owners: readonly Owner[]
  readonly cat: Cat | null
  readonly vacuum: Vacuum | null
  /** The night is dark: only torch beams see. */
  readonly dark: boolean
  /** The disguise the owners learned to distrust (from the player's habits). */
  readonly learned: PropKind | null
  readonly props: readonly Prop[]
  readonly targets: readonly number[]
  readonly bonus: readonly number[]
  readonly tickle: Tickle | null
  readonly alarmed: boolean
  readonly result: Result | null
  readonly nagCooldown: number
  /** Seconds in which owners cannot spot the jelly (just climbed in, or back in after being caught). */
  readonly grace: number
}

export interface PlayerInput {
  readonly move: Vec
  readonly interact: boolean
  readonly eyes: boolean
  readonly spit: boolean
}

export type Who = 'owner' | 'cat' | 'player'

/** A line someone says; the page turns it into words in the player's language. */
export type SpeechKey =
  | 'meow'
  | 'hiss'
  | 'catSaw'
  | 'catKnocked'
  | 'giggled'
  | 'fooled'
  | 'poke'
  | 'treasureGone'
  | 'missing'
  | 'missingUnknown'
  | 'newHere'
  | 'outOfPlace'
  | 'moved'
  | 'hm'
  | 'alarmBlob'
  | 'alarmMoved'
  | 'nothing'
  | 'caught'
  | 'lost'
  | 'vacuum'
  | 'learned'

export interface Speech {
  readonly key: SpeechKey
  readonly kind?: PropKind
  readonly room?: number
}

export type GameEvent =
  | { readonly type: 'morph'; readonly kind: PropKind | null }
  | { readonly type: 'swallowStart'; readonly propId: number }
  | { readonly type: 'swallow'; readonly propId: number }
  | { readonly type: 'full' }
  | { readonly type: 'spit'; readonly propId: number; readonly filled: boolean }
  | { readonly type: 'say'; readonly who: Who; readonly owner?: number; readonly line: Speech }
  | { readonly type: 'suspicious'; readonly owner: number; readonly pos: Vec }
  | { readonly type: 'alarm'; readonly owner: number }
  | { readonly type: 'lost'; readonly owner: number }
  | { readonly type: 'caught' }
  | { readonly type: 'tickleStart' }
  | { readonly type: 'pokeHit' }
  | { readonly type: 'pokeMiss' }
  | { readonly type: 'tickleDone' }
  | { readonly type: 'pounce' }
  | { readonly type: 'sucked' }
  | { readonly type: 'catScared' }
  | { readonly type: 'meow' }
  | { readonly type: 'needMain' }
  | { readonly type: 'win' }
