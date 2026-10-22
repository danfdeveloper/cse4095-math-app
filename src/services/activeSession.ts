import type { PracticeAttempt, SavedActiveSession } from '../types/session'
import {
  isCardProgress,
  isPracticeSession,
  isStoredQuestion,
} from '../utils/storedDataValidation'

/** A card nothing has been done to yet. */
export const FRESH_CARD = { selectedAnswer: null, flipped: false } as const

/**
 * The session that was in progress when the page was last closed or refreshed,
 * if what was saved can still be used, or null. Nothing saved is trusted: a
 * question that breaks the rules, one that does not belong to its session, or a
 * session that has in fact ended means starting afresh rather than continuing
 * from something wrong.
 *
 * The attempts are the record of what was answered, so the session's counts
 * come from them. A card that does not fit its question only loses its
 * progress, not the session.
 */
export function restoreActiveSession(
  saved: unknown,
  attempts: readonly PracticeAttempt[],
): SavedActiveSession | null {
  if (typeof saved !== 'object' || saved === null) return null
  const { session, currentQuestion, card } = saved as Record<string, unknown>

  if (!isPracticeSession(session) || session.completedAt !== undefined) {
    return null
  }
  if (!isStoredQuestion(currentQuestion)) return null
  const belongs =
    currentQuestion.difficulty === session.difficulty &&
    session.operations.includes(currentQuestion.operation) &&
    (currentQuestion.source === 'mistake-review') ===
      (session.mode === 'mistake-review')
  if (!belongs) return null

  const answered = attempts.filter(
    (attempt) => attempt.sessionId === session.id,
  )
  // Answered already, but the session was not moved on: there is no way to tell what came next.
  if (answered.some((attempt) => attempt.questionId === currentQuestion.id)) {
    return null
  }
  const attempted = answered.length
  if (
    session.sessionLength !== 'continuous' &&
    attempted >= session.sessionLength
  ) {
    return null
  }
  const correct = answered.filter(
    (attempt) => attempt.selfReportedCorrect,
  ).length

  const cardFits =
    isCardProgress(card) &&
    (card.selectedAnswer === null ||
      currentQuestion.choices.includes(card.selectedAnswer)) &&
    // Turned over means an answer was picked.
    (!card.flipped || card.selectedAnswer !== null)

  return {
    session: { ...session, attempted, correct, incorrect: attempted - correct },
    currentQuestion,
    card: cardFits ? card : { ...FRESH_CARD },
  }
}
