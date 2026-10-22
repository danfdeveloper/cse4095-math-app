import type {
  DifficultyLevel,
  MathOperation,
  Question,
  QuestionSource,
} from './question'

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

/** What the student has done with the card on screen: the answer picked, and whether it is turned over. */
export interface CardProgress {
  selectedAnswer: number | null
  flipped: boolean
}

/**
 * A session in progress, as it is saved so that a refresh does not lose it: the
 * session, the question on screen, and what has been done with that question.
 * Which question number it is comes from the saved attempts, not from here.
 */
export interface SavedActiveSession {
  session: PracticeSession
  currentQuestion: Question
  card: CardProgress
}
