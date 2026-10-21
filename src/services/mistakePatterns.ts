import type { MistakePattern } from '../types/mistake'
import type {
  DifficultyLevel,
  MathOperation,
  Question,
} from '../types/question'
import type { PracticeAttempt } from '../types/session'

/**
 * Mistake patterns: one record for each question the student has answered
 * incorrectly, however many times (specification sections 6.4 and 10.3).
 *
 * Two questions are the same pattern when they have the same operation, the
 * same two numbers in the same order, and the same difficulty. So 7 × 8 and
 * 8 × 7 are different patterns (the second is a similar question to the
 * first, not the same one), and so is the same sum missed at two levels.
 */

/** What makes one mistake pattern different from another. */
export type MistakePatternKey = Pick<
  MistakePattern,
  'operation' | 'firstOperand' | 'secondOperand' | 'difficulty'
>

/**
 * The pattern's ID, worked out from what makes it unique. Because of that, a
 * second record for the same pattern cannot exist under another ID.
 */
export function mistakePatternId({
  operation,
  firstOperand,
  secondOperand,
  difficulty,
}: MistakePatternKey): string {
  return `${operation}:${firstOperand}:${secondOperand}:${difficulty}`
}

/** Whether the student reported getting this attempt wrong. */
function isIncorrect(attempt: PracticeAttempt): boolean {
  return !attempt.selfReportedCorrect
}

/**
 * The later of two timestamps. A timestamp that cannot be read never beats
 * one that can: comparing with it is never true, so only the saved one needs
 * to be checked.
 */
function laterOf(saved: string, other: string): string {
  const savedTime = Date.parse(saved)
  return Date.parse(other) > savedTime || Number.isNaN(savedTime)
    ? other
    : saved
}

/** The pattern for a question answered incorrectly for the first time. */
export function createMistakePattern(attempt: PracticeAttempt): MistakePattern {
  return {
    id: mistakePatternId(attempt),
    operation: attempt.operation,
    firstOperand: attempt.firstOperand,
    secondOperand: attempt.secondOperand,
    correctAnswer: attempt.correctAnswer,
    difficulty: attempt.difficulty,
    incorrectCount: 1,
    similarCorrectCount: 0,
    lastIncorrectAt: attempt.attemptedAt,
    mastered: false,
  }
}

/**
 * The patterns after one more attempt. A correct attempt changes nothing and
 * gives back the same list. An incorrect one creates the pattern, or, if the
 * student has missed this question before, updates it in place: one more
 * mistake, a new last-incorrect time (never an earlier one), and any progress
 * toward mastery starts again, since the student has just got it wrong.
 */
export function recordMistake(
  patterns: readonly MistakePattern[],
  attempt: PracticeAttempt,
): MistakePattern[] {
  if (!isIncorrect(attempt)) return patterns as MistakePattern[]

  const id = mistakePatternId(attempt)
  const index = patterns.findIndex((pattern) => pattern.id === id)
  if (index === -1) return [...patterns, createMistakePattern(attempt)]

  const existing = patterns[index]
  const updated = [...patterns]
  updated[index] = {
    ...existing,
    incorrectCount: existing.incorrectCount + 1,
    lastIncorrectAt: laterOf(existing.lastIncorrectAt, attempt.attemptedAt),
    similarCorrectCount: 0,
    mastered: false,
  }
  return updated
}

/**
 * Takes one earlier mistake back, for an attempt that is being removed from
 * the history: the pattern has one fewer mistake, and goes if that was its
 * only one. What cannot be known any more (the earlier last-incorrect time,
 * and progress that the mistake reset) is left as it is.
 */
export function forgetMistake(
  patterns: readonly MistakePattern[],
  attempt: PracticeAttempt,
): MistakePattern[] {
  if (!isIncorrect(attempt)) return patterns as MistakePattern[]

  const id = mistakePatternId(attempt)
  const index = patterns.findIndex((pattern) => pattern.id === id)
  if (index === -1) return patterns as MistakePattern[]

  const existing = patterns[index]
  if (existing.incorrectCount <= 1) {
    return patterns.filter((_, position) => position !== index)
  }
  const updated = [...patterns]
  updated[index] = { ...existing, incorrectCount: existing.incorrectCount - 1 }
  return updated
}

/**
 * The patterns that the given attempts (oldest first) add up to, for when the
 * saved patterns are missing or unreadable but the attempts are not. Progress
 * toward mastery cannot be known from attempts, so every pattern starts again.
 */
export function rebuildMistakePatterns(
  attempts: readonly PracticeAttempt[],
): MistakePattern[] {
  return attempts.reduce<MistakePattern[]>(recordMistake, [])
}

/** The list without any later record of a pattern that appears earlier in it. */
export function withoutDuplicatePatterns(
  patterns: readonly MistakePattern[],
): MistakePattern[] {
  const seen = new Set<string>()
  return patterns.filter((pattern) => {
    if (seen.has(pattern.id)) return false
    seen.add(pattern.id)
    return true
  })
}

/** Which mistakes to look at: those of these operations, at this level. */
export interface ReviewScope {
  operations: readonly MathOperation[]
  difficulty: DifficultyLevel
}

/**
 * The mistakes still to practice: the ones not yet mastered. Given a scope,
 * only those whose own operation and level it covers.
 */
export function activePatterns(
  patterns: readonly MistakePattern[],
  scope?: ReviewScope,
): MistakePattern[] {
  return patterns.filter(
    (pattern) =>
      !pattern.mastered &&
      (scope === undefined ||
        (pattern.difficulty === scope.difficulty &&
          scope.operations.includes(pattern.operation))),
  )
}

/**
 * What a review answer does to the mistake that the question came from. A
 * correct answer is one step closer to mastery, and the pattern is mastered
 * once it has `threshold` of them. An incorrect answer is one step back (never
 * below none), and the pattern is no longer mastered. A pattern that is not
 * there any more is left out of it.
 */
export function recordReviewProgress(
  patterns: readonly MistakePattern[],
  patternId: string,
  correct: boolean,
  threshold: number,
): MistakePattern[] {
  const index = patterns.findIndex((pattern) => pattern.id === patternId)
  if (index === -1) return patterns as MistakePattern[]

  const existing = patterns[index]
  const similarCorrectCount = correct
    ? existing.similarCorrectCount + 1
    : Math.max(0, existing.similarCorrectCount - 1)
  const updated = [...patterns]
  updated[index] = {
    ...existing,
    similarCorrectCount,
    mastered:
      correct && (existing.mastered || similarCorrectCount >= threshold),
  }
  return updated
}

/**
 * The patterns after one answered question: an incorrect answer makes or
 * updates its own pattern (as it does for any question), and an answer to a
 * mistake-review question also moves the mistake it came from forward or back.
 */
export function patternsAfterAnswer(
  patterns: readonly MistakePattern[],
  question: Pick<Question, 'source' | 'mistakePatternId'>,
  attempt: PracticeAttempt,
  threshold: number,
): MistakePattern[] {
  const afterMistake = recordMistake(patterns, attempt)
  if (question.source !== 'mistake-review' || !question.mistakePatternId) {
    return afterMistake
  }
  return recordReviewProgress(
    afterMistake,
    question.mistakePatternId,
    attempt.selfReportedCorrect,
    threshold,
  )
}
