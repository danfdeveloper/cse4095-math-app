import { describe, expect, it } from 'vitest'
import { makeMistakePattern } from '../test/fixtures'
import { ALMOST_ONE, seededRandom } from '../test/seededRandom'
import type { MistakePattern } from '../types/mistake'
import {
  BASE_PRIORITY,
  FREQUENCY_CAP,
  FREQUENCY_WEIGHT,
  NEED_WEIGHT,
  pickReviewPattern,
  RECENCY_HALF_LIFE_DAYS,
  RECENCY_WEIGHT,
  reviewPriority,
} from './reviewPriority'

const NOW = new Date('2026-06-15T12:00:00.000Z')
const daysAgo = (days: number) =>
  new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
const context = { threshold: 3, now: NOW }

/** A mistake: how often it was missed, how long ago, and how much review is done. */
function mistake(
  incorrectCount: number,
  days: number,
  similarCorrectCount: number,
  overrides: Partial<MistakePattern> = {},
): MistakePattern {
  return makeMistakePattern({
    incorrectCount,
    lastIncorrectAt: daysAgo(days),
    similarCorrectCount,
    ...overrides,
  })
}

describe('reviewPriority', () => {
  it('is nothing for a mastered mistake', () => {
    expect(reviewPriority(mistake(9, 0, 3, { mastered: true }), context)).toBe(
      0,
    )
  })

  it('is at most the base plus all three reasons', () => {
    // Missed often, just now, with no review done.
    expect(reviewPriority(mistake(FREQUENCY_CAP, 0, 0), context)).toBeCloseTo(
      BASE_PRIORITY + FREQUENCY_WEIGHT + RECENCY_WEIGHT + NEED_WEIGHT,
      10,
    )
  })

  it('is about the base for a mistake missed once, long ago, with its review done', () => {
    expect(reviewPriority(mistake(1, 1000, 3), context)).toBeCloseTo(
      BASE_PRIORITY,
      6,
    )
  })

  it('is always above nothing for a mistake still to practice, so none is shut out', () => {
    for (const count of [1, 3, 50]) {
      for (const days of [0, 30, 3650]) {
        for (const progress of [0, 2, 3, 99]) {
          expect(
            reviewPriority(mistake(count, days, progress), context),
          ).toBeGreaterThanOrEqual(BASE_PRIORITY)
        }
      }
    }
  })

  it('works out to the numbers in the specification’s three reasons', () => {
    // Missed 3 times (half way up), a week ago (half), with 1 of 3 reviews done (two thirds still needed).
    const expected =
      BASE_PRIORITY +
      FREQUENCY_WEIGHT * ((3 - 1) / (FREQUENCY_CAP - 1)) +
      RECENCY_WEIGHT * 0.5 +
      NEED_WEIGHT * (2 / 3)

    expect(
      reviewPriority(mistake(3, RECENCY_HALF_LIFE_DAYS, 1), context),
    ).toBeCloseTo(expected, 10)
  })

  describe('a mistake missed more often comes first', () => {
    it('rises with each miss, up to the cap', () => {
      const priorities = [1, 2, 3, 4, 5].map((count) =>
        reviewPriority(mistake(count, 3, 1), context),
      )

      for (let i = 1; i < priorities.length; i++) {
        expect(priorities[i]).toBeGreaterThan(priorities[i - 1])
      }
    })

    it('stops rising after the cap', () => {
      expect(reviewPriority(mistake(FREQUENCY_CAP + 7, 3, 1), context)).toBe(
        reviewPriority(mistake(FREQUENCY_CAP, 3, 1), context),
      )
    })
  })

  describe('a mistake missed more recently comes first', () => {
    it('falls as the miss gets further away', () => {
      const priorities = [0, 1, 3, 7, 14, 60].map((days) =>
        reviewPriority(mistake(2, days, 1), context),
      )

      for (let i = 1; i < priorities.length; i++) {
        expect(priorities[i]).toBeLessThan(priorities[i - 1])
      }
    })

    it('halves for every week', () => {
      const recent = (days: number) =>
        reviewPriority(mistake(2, days, 1), context) -
        reviewPriority(mistake(2, 10_000, 1), context)

      expect(recent(RECENCY_HALF_LIFE_DAYS) / recent(0)).toBeCloseTo(0.5, 10)
      expect(recent(2 * RECENCY_HALF_LIFE_DAYS) / recent(0)).toBeCloseTo(
        0.25,
        10,
      )
    })

    it('treats a miss in the future, or one with no readable time, as just now', () => {
      const justNow = reviewPriority(mistake(2, 0, 1), context)

      expect(reviewPriority(mistake(2, -5, 1), context)).toBe(justNow)
      expect(
        reviewPriority(
          makeMistakePattern({
            incorrectCount: 2,
            similarCorrectCount: 1,
            lastIncorrectAt: 'sometime',
          }),
          context,
        ),
      ).toBe(justNow)
    })
  })

  describe('a mistake with little successful review comes first', () => {
    it('falls with each correct similar answer', () => {
      const priorities = [0, 1, 2, 3].map((progress) =>
        reviewPriority(mistake(2, 3, progress), context),
      )

      for (let i = 1; i < priorities.length; i++) {
        expect(priorities[i]).toBeLessThan(priorities[i - 1])
      }
    })

    it('does not go below having no need once the review is complete', () => {
      expect(reviewPriority(mistake(2, 3, 3), context)).toBe(
        reviewPriority(mistake(2, 3, 30), context),
      )
    })

    it('goes by the threshold: the same progress is less of the way at a higher one', () => {
      const at = (threshold: number) =>
        reviewPriority(mistake(2, 3, 2), { threshold, now: NOW })

      expect(at(1)).toBeLessThan(at(3))
      expect(at(3)).toBeLessThan(at(10))
    })
  })

  it('each reason counts for the same at most', () => {
    const base = reviewPriority(mistake(1, 10_000, 3), context)

    expect(
      reviewPriority(mistake(FREQUENCY_CAP, 10_000, 3), context) - base,
    ).toBeCloseTo(FREQUENCY_WEIGHT, 6)
    expect(reviewPriority(mistake(1, 0, 3), context) - base).toBeCloseTo(
      RECENCY_WEIGHT,
      6,
    )
    expect(reviewPriority(mistake(1, 10_000, 0), context) - base).toBeCloseTo(
      NEED_WEIGHT,
      6,
    )
  })

  it('does not change the mistake', () => {
    const original = mistake(2, 3, 1)
    const before = structuredClone(original)

    reviewPriority(original, context)

    expect(original).toEqual(before)
  })
})

describe('pickReviewPattern', () => {
  const pressing = mistake(5, 0, 0, {
    firstOperand: 1,
    secondOperand: 1,
    correctAnswer: 1,
  })
  const middling = mistake(3, 7, 1, {
    firstOperand: 2,
    secondOperand: 2,
    correctAnswer: 4,
  })
  const fading = mistake(1, 60, 2, {
    firstOperand: 3,
    secondOperand: 3,
    correctAnswer: 9,
  })
  const done = mistake(4, 0, 3, {
    firstOperand: 4,
    secondOperand: 4,
    correctAnswer: 16,
    mastered: true,
  })

  function frequencies(
    patterns: MistakePattern[],
    draws: number,
    seed: number,
  ): Map<string, number> {
    const random = seededRandom(seed)
    const counts = new Map(patterns.map((p) => [p.id, 0]))
    for (let i = 0; i < draws; i++) {
      const picked = pickReviewPattern(patterns, context, random)!
      counts.set(picked.id, counts.get(picked.id)! + 1)
    }
    return counts
  }

  it('gives nothing when there are no mistakes, or all are mastered', () => {
    expect(pickReviewPattern([], context)).toBeNull()
    expect(pickReviewPattern([done], context)).toBeNull()
  })

  it('gives the only mistake there is', () => {
    expect(pickReviewPattern([middling], context, seededRandom(1))).toBe(
      middling,
    )
  })

  it('never picks a mastered mistake', () => {
    const counts = frequencies([pressing, done, fading], 3000, 2)

    expect(counts.get(done.id)).toBe(0)
  })

  it('picks each mistake as often as its priority is high', () => {
    const patterns = [pressing, middling, fading]
    const draws = 40_000
    const counts = frequencies(patterns, draws, 3)
    const weights = patterns.map((p) => reviewPriority(p, context))
    const total = weights.reduce((a, b) => a + b, 0)

    patterns.forEach((pattern, i) => {
      expect(counts.get(pattern.id)! / draws).toBeCloseTo(weights[i] / total, 1)
    })
  })

  it('picks the more pressing mistake more often', () => {
    const counts = frequencies([pressing, middling, fading], 6000, 4)

    expect(counts.get(pressing.id)!).toBeGreaterThan(counts.get(middling.id)!)
    expect(counts.get(middling.id)!).toBeGreaterThan(counts.get(fading.id)!)
  })

  it('still picks the least pressing one now and then', () => {
    const counts = frequencies([pressing, middling, fading], 6000, 5)

    expect(counts.get(fading.id)!).toBeGreaterThan(100)
  })

  it('picks mistakes of the same priority about equally often', () => {
    const a = mistake(2, 3, 1, {
      firstOperand: 1,
      secondOperand: 1,
      correctAnswer: 1,
    })
    const b = mistake(2, 3, 1, {
      firstOperand: 2,
      secondOperand: 2,
      correctAnswer: 4,
    })
    const c = mistake(2, 3, 1, {
      firstOperand: 3,
      secondOperand: 3,
      correctAnswer: 9,
    })
    const draws = 30_000
    const counts = frequencies([a, b, c], draws, 6)

    for (const pattern of [a, b, c]) {
      expect(counts.get(pattern.id)! / draws).toBeGreaterThan(0.31)
      expect(counts.get(pattern.id)! / draws).toBeLessThan(0.355)
    }
  })

  it('gives the first mistake that counts when the random source is lowest', () => {
    expect(
      pickReviewPattern([done, pressing, middling], context, () => 0),
    ).toBe(pressing)
  })

  it('gives the last mistake that counts when the random source is highest', () => {
    expect(
      pickReviewPattern([pressing, middling, done], context, () => ALMOST_ONE),
    ).toBe(middling)
  })

  it('still gives the last mistake that counts if rounding takes the random source to exactly 1', () => {
    // A random source never returns 1, but rounding at the top of the range
    // must not leave the picker with nothing.
    expect(pickReviewPattern([middling, pressing], context, () => 1)).toBe(
      pressing,
    )
    expect(pickReviewPattern([pressing, done], context, () => 1)).toBe(pressing)
  })

  it('splits at the right place between two mistakes', () => {
    const [first, second] = [pressing, middling]
    const share =
      reviewPriority(first, context) /
      (reviewPriority(first, context) + reviewPriority(second, context))

    expect(
      pickReviewPattern([first, second], context, () => share - 0.001),
    ).toBe(first)
    expect(
      pickReviewPattern([first, second], context, () => share + 0.001),
    ).toBe(second)
  })

  it('does not change the list it was given', () => {
    const patterns = [pressing, middling, done]
    const before = structuredClone(patterns)

    pickReviewPattern(patterns, context, seededRandom(7))

    expect(patterns).toEqual(before)
  })
})
