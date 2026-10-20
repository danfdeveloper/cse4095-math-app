import type { RandomSource } from '../utils/math'

/** The largest value a RandomSource may return: just under 1. */
export const ALMOST_ONE = 1 - 1e-9

/** A reproducible pseudo-random source (mulberry32), so tests never flake. */
export function seededRandom(seed: number): RandomSource {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Returns the given values in order, repeating from the start when exhausted. */
export function sequenceRandom(values: number[]): RandomSource {
  let index = 0
  return () => values[index++ % values.length]
}
