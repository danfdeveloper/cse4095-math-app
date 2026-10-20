import { describe, expect, it } from 'vitest'
import { DIFFICULTY_LEVELS } from './practice'
import { DIVISION_RULES, quotientRangeFor } from './difficultyRules'

describe('division rules', () => {
  it.each(DIFFICULTY_LEVELS)(
    'never allow a zero (or negative) divisor at Level %i',
    (level) => {
      for (const range of DIVISION_RULES[level].divisors) {
        expect(range.min).toBeGreaterThanOrEqual(1)
      }
    },
  )

  it.each(DIFFICULTY_LEVELS)(
    'leave at least one whole-number answer for every allowed divisor at Level %i',
    (level) => {
      const rules = DIVISION_RULES[level]
      for (const range of rules.divisors) {
        for (let divisor = range.min; divisor <= range.max; divisor++) {
          const quotients = quotientRangeFor(rules, divisor)

          expect(quotients, `divisor ${divisor}`).not.toBeNull()
          expect(quotients!.min).toBeLessThanOrEqual(quotients!.max)
        }
      }
    },
  )
})

describe('quotientRangeFor', () => {
  it('uses the quotient limits when there are no dividend limits', () => {
    expect(quotientRangeFor(DIVISION_RULES[1], 3)).toEqual({ min: 0, max: 5 })
    expect(quotientRangeFor(DIVISION_RULES[2], 7)).toEqual({ min: 0, max: 10 })
  })

  it('keeps the dividend at or below its maximum', () => {
    expect(quotientRangeFor(DIVISION_RULES[3], 12)).toEqual({ min: 0, max: 12 })
    // 144 / 1 would be 144, but Level 3 answers stop at 12.
    expect(quotientRangeFor(DIVISION_RULES[3], 1)).toEqual({ min: 0, max: 12 })
  })

  it('keeps Level 4 dividends between 145 and 1000', () => {
    expect(quotientRangeFor(DIVISION_RULES[4], 2)).toEqual({
      min: 73,
      max: 500,
    })
    expect(quotientRangeFor(DIVISION_RULES[4], 99)).toEqual({ min: 2, max: 10 })
  })

  it('returns null when no whole-number answer fits', () => {
    const rules = {
      divisors: [{ min: 3, max: 3 }],
      quotients: { min: 0, max: 5 },
      minDividend: 100,
    }

    expect(quotientRangeFor(rules, 3)).toBeNull()
  })
})
