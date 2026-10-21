import type { DifficultyLevel, MathOperation, QuestionSource } from './question'

export type SessionLength = number | 'continuous'

/**
 * What a session is for: ordinary practice, or practice on questions like the
 * ones the student got wrong before (specification section 6.2).
 */
export type PracticeMode = 'regular' | 'mistake-review'

/** What the student reports after flipping a card. */
export interface QuestionResult {
  selectedAnswer: number
  selfReportedCorrect: boolean
}

/** The choices a student makes on the practice setup page. */
export interface PracticeConfig {
  operations: MathOperation[]
  difficulty: DifficultyLevel
  sessionLength: SessionLength
  /**
   * Left out for regular practice. For mistake review, the operations and
   * difficulty choose which mistakes are reviewed.
   */
  mode?: PracticeMode
}

export interface PracticeAttempt {
  id: string
  questionId: string
  operation: MathOperation
  firstOperand: number
  secondOperand: number
  correctAnswer: number
  selectedAnswer: number
  selfReportedCorrect: boolean
  difficulty: DifficultyLevel
  source: QuestionSource
  /**
   * The mistake pattern that a mistake-review question was made from. Left out
   * for regular questions, and for attempts saved before review mode existed.
   */
  mistakePatternId?: string
  attemptedAt: string
  sessionId: string
}

export interface PracticeSession {
  id: string
  startedAt: string
  completedAt?: string
  operations: MathOperation[]
  difficulty: DifficultyLevel
  sessionLength: SessionLength
  attempted: number
  correct: number
  incorrect: number
  /** Left out for regular practice, and for sessions saved before review mode existed. */
  mode?: PracticeMode
}
