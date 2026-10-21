import type { MistakePattern } from '../types/mistake'
import type { RandomSource } from '../utils/math'

/**
 * Which mistake to practice next (specification section 6.4, "Review
 * Priority"). A mistake has more priority when it was missed more times, when
 * it was missed more recently, and when similar questions have not yet been
 * answered correctly. It has none once it is mastered.
 */

/** Every mistake still to practice has at least this much, so none is ever shut out. */
export const BASE_PRIORITY = 1
/** The most that each of the three reasons can add. */
export const FREQUENCY_WEIGHT = 4
export const RECENCY_WEIGHT = 4
export const NEED_WEIGHT = 4
/** Misses beyond this many do not raise the priority further. */
export const FREQUENCY_CAP = 5
/** The recency reason halves for every week since the last miss. */
export const RECENCY_HALF_LIFE_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000

export interface PriorityContext {
  /** How many correct similar questions master a mistake. */
  threshold: number
  now: Date
}

/**
 * How much the mistake needs practice: from BASE_PRIORITY (a mistake missed
 * once, long ago, with its review nearly done) up to BASE_PRIORITY plus all
 * three weights. A mastered mistake has none.
 */
export function reviewPriority(
  pattern: MistakePattern,
  { threshold, now }: PriorityContext,
): number {
  if (pattern.mastered) return 0

  // 0 for one miss, 1 for FREQUENCY_CAP or more.
  const frequency =
    (Math.min(pattern.incorrectCount, FREQUENCY_CAP) - 1) / (FREQUENCY_CAP - 1)

  // 1 for a miss just now, then half as much every week. A time that cannot be
  // read, or is in the future, counts as just now.
  const lastMissed = Date.parse(pattern.lastIncorrectAt)
  const days = Number.isNaN(lastMissed)
    ? 0
    : Math.max(0, (now.getTime() - lastMissed) / DAY_MS)
  const recency = 0.5 ** (days / RECENCY_HALF_LIFE_DAYS)

  // 1 with no review done, 0 once the review is complete.
  const need = Math.min(
    1,
    Math.max(0, 1 - pattern.similarCorrectCount / threshold),
  )

  return (
    BASE_PRIORITY +
    FREQUENCY_WEIGHT * frequency +
    RECENCY_WEIGHT * recency +
    NEED_WEIGHT * need
  )
}

/**
 * Picks one mistake at random, each as likely as its priority is high. So
 * mistakes of similar priority are about equally likely, a more pressing one
 * comes up more often, and none that is still to practice is left out.
 * Returns null when there is nothing to pick.
 */
export function pickReviewPattern(
  patterns: readonly MistakePattern[],
  context: PriorityContext,
  random: RandomSource = Math.random,
): MistakePattern | null {
  const weights = patterns.map((pattern) => reviewPriority(pattern, context))
  const total = weights.reduce((sum, weight) => sum + weight, 0)

  let remaining = random() * total
  for (let index = 0; index < patterns.length; index++) {
    remaining -= weights[index]
    if (remaining < 0 && weights[index] > 0) return patterns[index]
  }
  // Reached by rounding at the very top of the range (the last one that counts),
  // or when nothing has any priority, which leaves nothing to pick.
  for (let index = patterns.length - 1; index >= 0; index--) {
    if (weights[index] > 0) return patterns[index]
  }
  return null
}
