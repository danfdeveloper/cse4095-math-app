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
}
