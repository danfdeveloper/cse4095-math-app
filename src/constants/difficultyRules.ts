import type { DifficultyLevel } from '../types/question'
import type { NumberRange } from '../utils/math'

/**
 * The number rules for each difficulty level, from specification section 7.
 * Both the question generator and the question validator read these tables, so
 * a generated question can never drift out of its level.
 *
 * Where the specification is silent the choice made here is noted inline.
 */

/**
 * The smallest value an answer or answer choice may have. No level produces
 * negative answers yet. When the optional negative answers for Level 4 are
 * added, this has to become a per-level setting.
 */
export const MIN_ANSWER_VALUE = 0

/** "One-digit" and "two-digit" numbers, as used by Levels 3 and 4. */
export const ONE_DIGIT: NumberRange = { min: 0, max: 9 }
export const TWO_DIGIT: NumberRange = { min: 10, max: 99 }

export interface AdditionRules {
  operands: NumberRange
  /** Results may not exceed this. Absent when the spec sets no cap. */
  maxSum?: number
}

export const ADDITION_RULES: Record<DifficultyLevel, AdditionRules> = {
  1: { operands: { min: 0, max: 10 }, maxSum: 20 },
  2: { operands: { min: 0, max: 50 }, maxSum: 100 },
  3: { operands: { min: 0, max: 100 } },
  // "Multiple-digit addition" with "numbers up to 1,000".
  4: { operands: { min: 10, max: 1000 } },
}

export interface SubtractionRules {
  operands: NumberRange
}

/** Answers are never negative in this release (negatives are an optional Level 4 extra). */
export const SUBTRACTION_RULES: Record<DifficultyLevel, SubtractionRules> = {
  1: { operands: { min: 0, max: 10 } },
  2: { operands: { min: 0, max: 50 } },
  3: { operands: { min: 0, max: 100 } },
  4: { operands: { min: 10, max: 1000 } },
}

/** One allowed pairing of factors. Factors may be shown in either order. */
export interface FactorShape {
  first: NumberRange
  second: NumberRange
}

export const MULTIPLICATION_RULES: Record<DifficultyLevel, FactorShape[]> = {
  1: [{ first: { min: 0, max: 5 }, second: { min: 0, max: 5 } }],
  2: [{ first: { min: 0, max: 10 }, second: { min: 0, max: 10 } }],
  3: [
    { first: ONE_DIGIT, second: ONE_DIGIT },
    { first: ONE_DIGIT, second: TWO_DIGIT },
  ],
  4: [
    { first: TWO_DIGIT, second: ONE_DIGIT },
    { first: TWO_DIGIT, second: TWO_DIGIT },
  ],
}

export interface DivisionRules {
  /** Allowed divisors, as groups that are chosen between with equal chance. */
  divisors: NumberRange[]
  quotients: NumberRange
  minDividend?: number
  maxDividend?: number
}

/**
 * The spec gives divisor limits (and Level 3's 144 cap) but no quotient range.
 * Levels 1-3 use the same limits as that level's multiplication tables, so a
 * division is always the inverse of a times-table fact. Level 4 has "larger
 * dividends", read as bigger than Level 3's 144, up to 1,000; its divisors skip
 * 1 because dividing by one is not useful practice.
 */
export const DIVISION_RULES: Record<DifficultyLevel, DivisionRules> = {
  1: {
    divisors: [{ min: 1, max: 5 }],
    quotients: { min: 0, max: 5 },
  },
  2: {
    divisors: [{ min: 1, max: 10 }],
    quotients: { min: 0, max: 10 },
  },
  3: {
    divisors: [{ min: 1, max: 12 }],
    quotients: { min: 0, max: 12 },
    maxDividend: 144,
  },
  4: {
    // One-digit and two-digit divisors, each chosen about half the time.
    divisors: [
      { min: 2, max: 9 },
      { min: 10, max: 99 },
    ],
    quotients: { min: 1, max: 1000 },
    minDividend: 145,
    maxDividend: 1000,
  },
}

/** The quotients a given divisor may have at a level, or null if there are none. */
export function quotientRangeFor(
  rules: DivisionRules,
  divisor: number,
): NumberRange | null {
  const min = Math.max(
    rules.quotients.min,
    rules.minDividend === undefined
      ? Number.NEGATIVE_INFINITY
      : Math.ceil(rules.minDividend / divisor),
  )
  const max = Math.min(
    rules.quotients.max,
    rules.maxDividend === undefined
      ? Number.POSITIVE_INFINITY
      : Math.floor(rules.maxDividend / divisor),
  )
  return min <= max ? { min, max } : null
}
