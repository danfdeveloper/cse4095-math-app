import type { DifficultyLevel, MathOperation } from './question'

/** Attempt counts for one grouping. Used for both operations and difficulty levels. */
export interface OperationStatistics {
  attempted: number
  correct: number
  incorrect: number
}

export interface AppStatistics {
  attempted: number
  correct: number
  incorrect: number
  byOperation: Record<MathOperation, OperationStatistics>
  byDifficulty: Record<DifficultyLevel, OperationStatistics>
  /**
   * The questions answered in mistake practice, a part of the totals above.
   * Kept as a running total, like the rest, so that it survives old attempt
   * records being archived.
   */
  mistakeReview: OperationStatistics
}
