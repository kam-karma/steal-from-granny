/** Mulberry32: small seeded PRNG so layouts and tests are repeatable. */
export function rngFrom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** One step of a seed chain, for pure state updates that need randomness. */
export function nextSeed(seed: number): number {
  return (Math.imul(seed ^ (seed >>> 13), 0x5bd1e995) + 0x9e3779b9) >>> 0
}

export function seedToUnit(seed: number): number {
  return rngFrom(seed)()
}
