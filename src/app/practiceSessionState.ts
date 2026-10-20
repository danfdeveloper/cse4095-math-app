import {
  createEmptyStatistics,
  recordAttemptInStatistics,
  removeAttemptFromStatistics,
} from '../services/statisticsService'
import type { Question } from '../types/question'
import type {
  PracticeAttempt,
  PracticeConfig,
  PracticeSession,
  QuestionResult,
} from '../types/session'
import type { AppStatistics } from '../types/statistics'
import { generateId } from '../utils/ids'
import { removeSession, upsertSession } from '../utils/sessionHistory'

/** Everything about the practice in progress, or just finished (specification section 12). */
export interface PracticeSessionState {
  /** The current session, or the one that just ended. Null before any session. */
  session: PracticeSession | null
  currentQuestion: Question | null
  /** Zero-based position of the question on screen. */
  currentQuestionIndex: number
  /** Every recorded attempt, oldest first. */
  attempts: PracticeAttempt[]
  /**
   * Sessions with at least one answer, oldest first, as they are saved. The
   * current session joins this list when its first answer is recorded.
   */
  sessions: PracticeSession[]
  /** Running totals of every answered question, overall and by operation and level. */
  statistics: AppStatistics
}

export const initialPracticeSessionState: PracticeSessionState = {
  session: null,
  currentQuestion: null,
  currentQuestionIndex: 0,
  attempts: [],
  sessions: [],
  statistics: createEmptyStatistics(),
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
    }
  | { type: 'sessionEnded'; completedAt: string }
  | { type: 'sessionDiscarded' }
  /** Erases all practice history and statistics, and any session in progress. */
  | { type: 'historyReset' }

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
        attempts: [...state.attempts, attempt],
        sessions: upsertSession(state.sessions, updated),
        statistics: recordAttemptInStatistics(state.statistics, attempt),
      }
    }

    case 'sessionEnded': {
      if (!isSessionActive(state) || state.session === null) return state
      const ended = { ...state.session, completedAt: action.completedAt }
      return {
        ...state,
        session: ended,
        currentQuestion: null,
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
      }
    }

    case 'historyReset':
      return {
        ...initialPracticeSessionState,
        statistics: createEmptyStatistics(),
      }
  }
}
