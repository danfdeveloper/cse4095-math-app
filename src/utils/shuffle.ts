import { randomInt, type RandomSource } from './math'

/** Returns a new, uniformly shuffled copy (Fisher-Yates). The input is not changed. */
export function shuffle<T>(
  items: readonly T[],
  random: RandomSource = Math.random,
): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(0, i, random)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
