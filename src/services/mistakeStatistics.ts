import { MATH_OPERATIONS } from '../constants/practice'
import type { MistakePattern } from '../types/mistake'
import type { MathOperation } from '../types/question'
import type { AppStatistics } from '../types/statistics'
import { activePatterns } from './mistakePatterns'

/**
 * What the statistics page says about mistakes (specification section 6.6,
 * "Mistake Review Statistics"), worked out from the saved mistake patterns and
 * the saved totals.
 */

/** How many frequently missed number facts are listed. */
export const MISSED_FACTS_SHOWN = 5

/** A question the student has missed, counted over every level it was missed at. */
export interface MissedFact {
  operation: MathOperation
  firstOperand: number
  secondOperand: number
  correctAnswer: number
  /** How many times it was answered incorrectly. */
  misses: number
  /** When it was last answered incorrectly. */
  lastIncorrectAt: string
}

/** The operation or operations missed most, with how many misses each had. */
export interface MostMissedOperation {
  /** More than one when they are tied, in the usual order of the operations. */
  operations: MathOperation[]
  misses: number
}

export interface MistakeStatistics {
  /** Mistakes still to practice. */
  active: number
  mastered: number
  /** Review questions answered, right or wrong. */
  similarPracticed: number
  /** Review questions answered correctly. */
  similarCorrect: number
  /** Null when nothing has been missed. */
  mostMissedOperation: MostMissedOperation | null
  /** The most missed first, at most MISSED_FACTS_SHOWN of them. */
  missedFacts: MissedFact[]
}

/** A sort comparison that puts the later timestamp first. A time that cannot be read counts as the earliest. */
function laterFirst(a: string, b: string): number {
  const timeA = Date.parse(a)
  const timeB = Date.parse(b)
  return (
    (Number.isNaN(timeB) ? -Infinity : timeB) -
    (Number.isNaN(timeA) ? -Infinity : timeA)
  )
}

const OPERATION_ORDER = new Map(
  MATH_OPERATIONS.map((operation, index) => [operation, index]),
)

/**
 * Mistakes in the order they are listed: the most often missed first. Where
 * two have been missed the same number of times, the one missed more recently
 * comes first, and after that the order is fixed (by operation, then by the
 * numbers, then by level), so that a list never changes order by itself.
 */
export function sortMistakePatterns(
  patterns: readonly MistakePattern[],
): MistakePattern[] {
  return [...patterns].sort(
    (a, b) =>
      b.incorrectCount - a.incorrectCount ||
      laterFirst(a.lastIncorrectAt, b.lastIncorrectAt) ||
      (OPERATION_ORDER.get(a.operation) ?? 0) -
        (OPERATION_ORDER.get(b.operation) ?? 0) ||
      a.firstOperand - b.firstOperand ||
      a.secondOperand - b.secondOperand ||
      a.difficulty - b.difficulty,
  )
}

/** The mistakes to practice, and the mastered ones, each in listing order. */
export function splitMistakes(patterns: readonly MistakePattern[]): {
  active: MistakePattern[]
  mastered: MistakePattern[]
} {
  const sorted = sortMistakePatterns(patterns)
  return {
    active: activePatterns(sorted),
    mastered: sorted.filter((pattern) => pattern.mastered),
  }
}

/**
 * The questions missed most (Task 64). The same question missed at different
 * levels is one fact, with its misses added up. Ties are broken as for the
 * list of mistakes.
 */
export function missedFacts(
  patterns: readonly MistakePattern[],
  limit: number = MISSED_FACTS_SHOWN,
): MissedFact[] {
  const facts = new Map<string, MissedFact>()
  for (const pattern of patterns) {
    const key = `${pattern.operation}:${pattern.firstOperand}:${pattern.secondOperand}`
    const known = facts.get(key)
    if (known === undefined) {
      facts.set(key, {
        operation: pattern.operation,
        firstOperand: pattern.firstOperand,
        secondOperand: pattern.secondOperand,
        correctAnswer: pattern.correctAnswer,
        misses: pattern.incorrectCount,
        lastIncorrectAt: pattern.lastIncorrectAt,
      })
    } else {
      known.misses += pattern.incorrectCount
      if (laterFirst(known.lastIncorrectAt, pattern.lastIncorrectAt) > 0) {
        known.lastIncorrectAt = pattern.lastIncorrectAt
      }
    }
  }

  return [...facts.values()]
    .sort(
      (a, b) =>
        b.misses - a.misses ||
        laterFirst(a.lastIncorrectAt, b.lastIncorrectAt) ||
        (OPERATION_ORDER.get(a.operation) ?? 0) -
          (OPERATION_ORDER.get(b.operation) ?? 0) ||
        a.firstOperand - b.firstOperand ||
        a.secondOperand - b.secondOperand,
    )
    .slice(0, limit)
}

/**
 * The operation missed most often, counting every miss of every mistake,
 * mastered ones too (Task 64). Operations with equally many misses are all
 * given. Null when nothing has been missed.
 */
export function mostMissedOperation(
  patterns: readonly MistakePattern[],
): MostMissedOperation | null {
  const misses = new Map<MathOperation, number>()
  for (const pattern of patterns) {
    misses.set(
      pattern.operation,
      (misses.get(pattern.operation) ?? 0) + pattern.incorrectCount,
    )
  }
  const most = Math.max(0, ...misses.values())
  if (most === 0) return null

  return {
    operations: MATH_OPERATIONS.filter(
      (operation) => misses.get(operation) === most,
    ),
    misses: most,
  }
}

/** Everything the page says about mistakes. */
export function buildMistakeStatistics(
  patterns: readonly MistakePattern[],
  statistics: Pick<AppStatistics, 'mistakeReview'>,
): MistakeStatistics {
  return {
    active: activePatterns(patterns).length,
    mastered: patterns.filter((pattern) => pattern.mastered).length,
    similarPracticed: statistics.mistakeReview.attempted,
    similarCorrect: statistics.mistakeReview.correct,
    mostMissedOperation: mostMissedOperation(patterns),
    missedFacts: missedFacts(patterns),
  }
}
