import { DEFAULT_SETTINGS } from '../constants/settings'
import { FRESH_CARD } from '../services/activeSession'
import { forgetMistake, patternsAfterAnswer } from '../services/mistakePatterns'
import {
  createEmptyStatistics,
  recordAttemptInStatistics,
  removeAttemptFromStatistics,
} from '../services/statisticsService'
import type { MistakePattern } from '../types/mistake'
import type { Question } from '../types/question'
import type {
  CardProgress,
  PracticeAttempt,
  PracticeConfig,
  PracticeSession,
  QuestionResult,
} from '../types/session'
import type { AppStatistics } from '../types/statistics'
import { generateId } from '../utils/ids'
import {
  limitAttempts,
  removeSession,
  upsertSession,
} from '../utils/sessionHistory'

/** Everything about the practice in progress, or just finished (specification section 12). */
export interface PracticeSessionState {
  /** The current session, or the one that just ended. Null before any session. */
  session: PracticeSession | null
  currentQuestion: Question | null
  /** Zero-based position of the question on screen. */
  currentQuestionIndex: number
  /** What has been done with the question on screen, kept so that a refresh can bring it back. */
  card: CardProgress
  /** Every recorded attempt, oldest first. */
  attempts: PracticeAttempt[]
  /**
   * Sessions with at least one answer, oldest first, as they are saved. The
   * current session joins this list when its first answer is recorded.
   */
  sessions: PracticeSession[]
  /** Running totals of every answered question, overall and by operation and level. */
  statistics: AppStatistics
  /** One record for each question the student has answered incorrectly, however often. */
  mistakePatterns: MistakePattern[]
}

export const initialPracticeSessionState: PracticeSessionState = {
  session: null,
  currentQuestion: null,
  currentQuestionIndex: 0,
  card: { ...FRESH_CARD },
  attempts: [],
  sessions: [],
  statistics: createEmptyStatistics(),
  mistakePatterns: [],
}

export type PracticeSessionAction =
  | {
      type: 'sessionStarted'
      session: PracticeSession
      firstQuestion: Question
    }
  | {
      type: 'resultRecorded'
      attempt: PracticeAttempt
      /** Null when that was the last question, which ends the session. */
      nextQuestion: Question | null
      /** How many correct similar questions master a mistake, from the settings. */
      masteryThreshold?: number
    }
  /** The student picked an answer, or turned the card over. */
  | { type: 'cardChanged'; questionId: string; card: CardProgress }
  | { type: 'sessionEnded'; completedAt: string }
  | { type: 'sessionDiscarded' }
  /** Erases all practice history, statistics and mistakes, and any session in progress. */
  | { type: 'historyReset' }
  /**
   * Another tab saved practice: take its history, totals and mistakes as the
   * latest, keeping this tab's own session in progress.
   */
  | {
      type: 'historyLoaded'
      attempts: PracticeAttempt[]
      sessions: PracticeSession[]
      statistics: AppStatistics
      mistakePatterns: MistakePattern[]
    }

/** Whether a session is in progress: one exists, has not ended, and has a question to show. */
export function isSessionActive(state: PracticeSessionState): boolean {
  return (
    state.session !== null &&
    state.session.completedAt === undefined &&
    state.currentQuestion !== null
  )
}

/** Whether the question on screen is the last one of a fixed-length session. */
export function isFinalQuestion(session: PracticeSession): boolean {
  return (
    session.sessionLength !== 'continuous' &&
    session.attempted + 1 >= session.sessionLength
  )
}

/** A new, empty session for a setup. Not pure: it makes an ID and reads the clock. */
export function createSession(
  config: PracticeConfig,
  now: Date = new Date(),
): PracticeSession {
  return {
    id: generateId(),
    startedAt: now.toISOString(),
    operations: [...config.operations],
    difficulty: config.difficulty,
    sessionLength: config.sessionLength,
    attempted: 0,
    correct: 0,
    incorrect: 0,
    // Regular practice carries no mode, as sessions saved before review mode do not.
    ...(config.mode === 'mistake-review' ? { mode: config.mode } : {}),
  }
}

/** The record of one answered question. Not pure: it makes an ID and reads the clock. */
export function createAttempt(
  session: PracticeSession,
  question: Question,
  result: QuestionResult,
  now: Date = new Date(),
): PracticeAttempt {
  return {
    id: generateId(),
    questionId: question.id,
    operation: question.operation,
    firstOperand: question.firstOperand,
    secondOperand: question.secondOperand,
    correctAnswer: question.correctAnswer,
    selectedAnswer: result.selectedAnswer,
    selfReportedCorrect: result.selfReportedCorrect,
    difficulty: question.difficulty,
    source: question.source,
    ...(question.mistakePatternId === undefined
      ? {}
      : { mistakePatternId: question.mistakePatternId }),
    attemptedAt: now.toISOString(),
    sessionId: session.id,
  }
}

export function practiceSessionReducer(
  state: PracticeSessionState,
  action: PracticeSessionAction,
): PracticeSessionState {
  switch (action.type) {
    case 'sessionStarted':
      // Starting again replaces any earlier session; past attempts are kept.
      return {
        ...state,
        session: action.session,
        currentQuestion: action.firstQuestion,
        currentQuestionIndex: 0,
        card: { ...FRESH_CARD },
      }

    case 'resultRecorded': {
      const { session, currentQuestion } = state
      const { attempt, nextQuestion } = action

      // Count an attempt only for the question on screen, and only once. A
      // second report for the same question (a double click, or a stale
      // callback) finds the question already moved on and changes nothing.
      if (
        !isSessionActive(state) ||
        session === null ||
        currentQuestion === null ||
        attempt.sessionId !== session.id ||
        attempt.questionId !== currentQuestion.id
      ) {
        return state
      }

      const updated: PracticeSession = {
        ...session,
        attempted: session.attempted + 1,
        correct: session.correct + (attempt.selfReportedCorrect ? 1 : 0),
        incorrect: session.incorrect + (attempt.selfReportedCorrect ? 0 : 1),
        ...(nextQuestion === null ? { completedAt: attempt.attemptedAt } : {}),
      }
      return {
        session: updated,
        currentQuestion: nextQuestion,
        currentQuestionIndex: state.currentQuestionIndex + 1,
        card: { ...FRESH_CARD },
        // The oldest details are archived once there are very many (section 23).
        attempts: limitAttempts([...state.attempts, attempt]),
        sessions: upsertSession(state.sessions, updated),
        statistics: recordAttemptInStatistics(state.statistics, attempt),
        // An incorrect answer creates or updates its pattern, and an answer to a
        // review question moves the mistake it came from, in the same step as the attempt.
        mistakePatterns: patternsAfterAnswer(
          state.mistakePatterns,
          currentQuestion,
          attempt,
          action.masteryThreshold ?? DEFAULT_SETTINGS.masteryThreshold,
        ),
      }
    }

    case 'cardChanged': {
      const { currentQuestion } = state
      const { card } = action
      // Only for the question on screen, with an answer that is one of its choices.
      if (
        // No question means no session in progress.
        currentQuestion === null ||
        action.questionId !== currentQuestion.id ||
        (card.selectedAnswer !== null &&
          !currentQuestion.choices.includes(card.selectedAnswer)) ||
        (card.flipped && card.selectedAnswer === null)
      ) {
        return state
      }
      // The same again: keep the state, so that nothing is saved for nothing.
      if (
        card.selectedAnswer === state.card.selectedAnswer &&
        card.flipped === state.card.flipped
      ) {
        return state
      }
      return { ...state, card: { ...card } }
    }

    case 'sessionEnded': {
      if (!isSessionActive(state) || state.session === null) return state
      const ended = { ...state.session, completedAt: action.completedAt }
      return {
        ...state,
        session: ended,
        currentQuestion: null,
        card: { ...FRESH_CARD },
        // A session with nothing answered is never kept in the history.
        sessions:
          ended.attempted > 0
            ? upsertSession(state.sessions, ended)
            : state.sessions,
      }
    }

    case 'sessionDiscarded': {
      const discarded = state.session
      if (discarded === null) return state
      const attempts = state.attempts.filter(
        (attempt) => attempt.sessionId !== discarded.id,
      )
      const removed = state.attempts.filter(
        (attempt) => attempt.sessionId === discarded.id,
      )
      return {
        session: null,
        currentQuestion: null,
        currentQuestionIndex: 0,
        card: { ...FRESH_CARD },
        // Keep the same list when nothing was removed, so nothing is saved again.
        attempts:
          attempts.length === state.attempts.length ? state.attempts : attempts,
        sessions: state.sessions.some((saved) => saved.id === discarded.id)
          ? removeSession(state.sessions, discarded.id)
          : state.sessions,
        // Take the discarded answers back out of the totals as well.
        statistics:
          removed.length === 0
            ? state.statistics
            : removed.reduce(removeAttemptFromStatistics, state.statistics),
        // ...and the mistakes those answers made.
        mistakePatterns: removed.reduce(forgetMistake, state.mistakePatterns),
      }
    }

    case 'historyLoaded': {
      // Everything was erased in the other tab, which ends the practice here too.
      const erased =
        action.statistics.attempted === 0 &&
        action.attempts.length === 0 &&
        action.sessions.length === 0 &&
        action.mistakePatterns.length === 0
      if (erased && state.statistics.attempted > 0) {
        return { ...initialPracticeSessionState, statistics: action.statistics }
      }
      const { session } = state
      // This tab's session counts as saved once it has an answer; keep its newest copy.
      const sessions =
        isSessionActive(state) && session !== null && session.attempted > 0
          ? upsertSession(action.sessions, session)
          : action.sessions
      return {
        ...state,
        attempts: action.attempts,
        sessions,
        statistics: action.statistics,
        mistakePatterns: action.mistakePatterns,
      }
    }

    case 'historyReset':
      return {
        ...initialPracticeSessionState,
        statistics: createEmptyStatistics(),
      }
  }
}
