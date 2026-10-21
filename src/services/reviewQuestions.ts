import type { MistakePattern } from '../types/mistake'
import type { Question } from '../types/question'
import type { PracticeAttempt, PracticeSession } from '../types/session'
import type { RandomSource } from '../utils/math'
import { activePatterns, type ReviewScope } from './mistakePatterns'
import { pickReviewPattern } from './reviewPriority'
import { generateSimilarQuestion, type QuestionSpec } from './similarQuestions'

/** How many of a session's latest questions a review question keeps away from. */
export const RECENT_QUESTIONS_TO_AVOID = 8

export interface ReviewContext {
  /** How many correct similar questions master a mistake. */
  threshold: number
  now: Date
  /** The mistake that the question just asked came from, if any. */
  previousPatternId?: string
  /** Questions to keep away from, so the same one does not come round too often. */
  recent?: readonly QuestionSpec[]
}

/**
 * The next question of a mistake-review session: one of the mistakes in scope
 * that still need practice, chosen by priority, and a question like it. The
 * mistake before is not chosen again unless it is the only one left, so a
 * session mixes its mistakes. Returns null when no mistake in scope still needs
 * practice, which is when a review session is over.
 */
export function generateReviewQuestion(
  patterns: readonly MistakePattern[],
  scope: ReviewScope,
  { threshold, now, previousPatternId, recent }: ReviewContext,
  random: RandomSource = Math.random,
): Question | null {
  const active = activePatterns(patterns, scope)
  if (active.length === 0) return null

  const others = active.filter((pattern) => pattern.id !== previousPatternId)
  const pattern = pickReviewPattern(
    others.length > 0 ? others : active,
    { threshold, now },
    random,
  )
  if (pattern === null) return null

  return generateSimilarQuestion(pattern, random, { avoid: recent })
}

/**
 * The latest questions of a session, the one on screen included, as things to
 * keep away from when asking the next one.
 */
export function recentQuestionsOf(
  session: Pick<PracticeSession, 'id'>,
  attempts: readonly PracticeAttempt[],
  current: QuestionSpec | null,
  limit: number = RECENT_QUESTIONS_TO_AVOID,
): QuestionSpec[] {
  const asked: QuestionSpec[] = attempts
    .filter((attempt) => attempt.sessionId === session.id)
    .map(({ operation, firstOperand, secondOperand }) => ({
      operation,
      firstOperand,
      secondOperand,
    }))
  if (current !== null) {
    asked.push({
      operation: current.operation,
      firstOperand: current.firstOperand,
      secondOperand: current.secondOperand,
    })
  }
  return asked.slice(-limit)
}
