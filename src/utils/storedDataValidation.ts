import {
  createDefaultSettings,
  DEFAULT_SETTINGS,
  MASTERY_THRESHOLD_RANGE,
} from '../constants/settings'
import { mistakePatternId } from '../services/mistakePatterns'
import type { MistakePattern } from '../types/mistake'
import type { MathOperation, Question } from '../types/question'
import type {
  CardProgress,
  PracticeAttempt,
  PracticeSession,
} from '../types/session'
import type { AppSettings } from '../types/settings'
import type { AppStatistics, OperationStatistics } from '../types/statistics'
import { DIFFICULTY_LEVELS, MATH_OPERATIONS } from '../constants/practice'
import { calculateAnswer } from './math'
import {
  isDifficultyLevel,
  isPracticeModeOrAbsent,
  isSupportedOperation,
  isValidQuestion,
} from './validation'

/*
 * Checks for data read back from localStorage. Anything in storage may have
 * been edited, truncated, or written by another version, so nothing is trusted.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isWholeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

function isCount(value: unknown): value is number {
  return isWholeNumber(value) && value >= 0
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function isSessionLength(value: unknown): value is number | 'continuous' {
  return value === 'continuous' || (isWholeNumber(value) && value > 0)
}

function isOperationList(value: unknown): value is MathOperation[] {
  return (
    Array.isArray(value) &&
    value.every(isSupportedOperation) &&
    new Set(value).size === value.length
  )
}

export function isPracticeAttempt(value: unknown): value is PracticeAttempt {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.questionId) &&
    isSupportedOperation(value.operation) &&
    isWholeNumber(value.firstOperand) &&
    isWholeNumber(value.secondOperand) &&
    isWholeNumber(value.correctAnswer) &&
    isWholeNumber(value.selectedAnswer) &&
    typeof value.selfReportedCorrect === 'boolean' &&
    isDifficultyLevel(value.difficulty) &&
    (value.source === 'regular' || value.source === 'mistake-review') &&
    (value.mistakePatternId === undefined ||
      isNonEmptyString(value.mistakePatternId)) &&
    isTimestamp(value.attemptedAt) &&
    isNonEmptyString(value.sessionId)
  )
}

export function isPracticeSession(value: unknown): value is PracticeSession {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isTimestamp(value.startedAt) &&
    (value.completedAt === undefined || isTimestamp(value.completedAt)) &&
    isOperationList(value.operations) &&
    value.operations.length > 0 &&
    isDifficultyLevel(value.difficulty) &&
    isSessionLength(value.sessionLength) &&
    isPracticeModeOrAbsent(value.mode) &&
    isCount(value.attempted) &&
    isCount(value.correct) &&
    isCount(value.incorrect) &&
    // The totals must add up, or the record cannot be trusted.
    value.correct + value.incorrect === value.attempted
  )
}

/**
 * A saved question is only used if it is complete and passes every rule a
 * question must pass before it is shown (specification section 18).
 */
export function isStoredQuestion(value: unknown): value is Question {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isSupportedOperation(value.operation) &&
    isWholeNumber(value.firstOperand) &&
    isWholeNumber(value.secondOperand) &&
    typeof value.displayText === 'string' &&
    isWholeNumber(value.correctAnswer) &&
    Array.isArray(value.choices) &&
    value.choices.every(isWholeNumber) &&
    isDifficultyLevel(value.difficulty) &&
    (value.source === 'regular' || value.source === 'mistake-review') &&
    (value.mistakePatternId === undefined ||
      isNonEmptyString(value.mistakePatternId)) &&
    isValidQuestion(value as unknown as Question)
  )
}

/** What was done with a card: an answer picked or not, and turned over or not. */
export function isCardProgress(value: unknown): value is CardProgress {
  return (
    isRecord(value) &&
    (value.selectedAnswer === null || isWholeNumber(value.selectedAnswer)) &&
    typeof value.flipped === 'boolean'
  )
}

/**
 * A saved mistake pattern is only used if it is complete, its numbers are real
 * numbers of this kind of question (so the answer really is the answer), its
 * ID is the one its contents give it, and it records at least one mistake.
 * Later phases make questions from these fields and trust them.
 */
export function isMistakePattern(value: unknown): value is MistakePattern {
  if (!(
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isSupportedOperation(value.operation) &&
    isCount(value.firstOperand) &&
    isCount(value.secondOperand) &&
    isCount(value.correctAnswer) &&
    isDifficultyLevel(value.difficulty) &&
    isCount(value.incorrectCount) &&
    value.incorrectCount >= 1 &&
    isCount(value.similarCorrectCount) &&
    isTimestamp(value.lastIncorrectAt) &&
    typeof value.mastered === 'boolean'
  )) {
    return false
  }

  return (
    calculateAnswer(
      value.operation,
      value.firstOperand,
      value.secondOperand,
    ) === value.correctAnswer &&
    value.id ===
      mistakePatternId({
        operation: value.operation,
        firstOperand: value.firstOperand,
        secondOperand: value.secondOperand,
        difficulty: value.difficulty,
      })
  )
}

/** The records of a saved list that are usable, or null if the list itself is not a list. */
export function keepValidRecords<T>(
  value: unknown,
  isValid: (record: unknown) => record is T,
): T[] | null {
  return Array.isArray(value) ? value.filter(isValid) : null
}

/**
 * Settings read back from storage, with every field that is missing or wrong
 * replaced by its default. One bad field does not lose the others.
 */
export function sanitizeSettings(value: unknown): AppSettings {
  if (!isRecord(value)) return createDefaultSettings()

  const flag = (saved: unknown, fallback: boolean) =>
    typeof saved === 'boolean' ? saved : fallback

  return {
    soundEffectsEnabled: flag(
      value.soundEffectsEnabled,
      DEFAULT_SETTINGS.soundEffectsEnabled,
    ),
    cardAnimationEnabled: flag(
      value.cardAnimationEnabled,
      DEFAULT_SETTINGS.cardAnimationEnabled,
    ),
    showExplanations: flag(
      value.showExplanations,
      DEFAULT_SETTINGS.showExplanations,
    ),
    feedbackEffectsEnabled: flag(
      value.feedbackEffectsEnabled,
      DEFAULT_SETTINGS.feedbackEffectsEnabled,
    ),
    defaultSessionLength: isSessionLength(value.defaultSessionLength)
      ? value.defaultSessionLength
      : DEFAULT_SETTINGS.defaultSessionLength,
    defaultDifficulty: isDifficultyLevel(value.defaultDifficulty)
      ? value.defaultDifficulty
      : DEFAULT_SETTINGS.defaultDifficulty,
    defaultOperations: isOperationList(value.defaultOperations)
      ? value.defaultOperations
      : [...DEFAULT_SETTINGS.defaultOperations],
    masteryThreshold:
      isWholeNumber(value.masteryThreshold) &&
      value.masteryThreshold >= MASTERY_THRESHOLD_RANGE.min &&
      value.masteryThreshold <= MASTERY_THRESHOLD_RANGE.max
        ? value.masteryThreshold
        : DEFAULT_SETTINGS.masteryThreshold,
  }
}

function isCounts(value: unknown): value is OperationStatistics {
  return (
    isRecord(value) &&
    isCount(value.attempted) &&
    isCount(value.correct) &&
    isCount(value.incorrect) &&
    value.correct + value.incorrect === value.attempted
  )
}

/**
 * Saved statistics are only used if every total agrees with every other: right
 * plus wrong is attempted, and the operations, and the levels, each add up to
 * the overall total. Anything else is treated as damaged.
 */
/** Statistics as saved. Those saved before mistake-practice totals were kept have none. */
export type SavedStatistics = Omit<AppStatistics, 'mistakeReview'> & {
  mistakeReview?: OperationStatistics
}

export function isAppStatistics(value: unknown): value is SavedStatistics {
  if (!isCounts(value)) return false
  const { byOperation, byDifficulty } = value as unknown as Record<
    string,
    unknown
  >
  if (!isRecord(byOperation) || !isRecord(byDifficulty)) return false

  const operations = MATH_OPERATIONS.map((operation) => byOperation[operation])
  const levels = DIFFICULTY_LEVELS.map((level) => byDifficulty[level])
  if (!operations.every(isCounts) || !levels.every(isCounts)) return false

  const adds = (
    groups: OperationStatistics[],
    key: keyof OperationStatistics,
  ) => groups.reduce((sum, group) => sum + group[key], 0) === value[key]
  const review = (value as unknown as Record<string, unknown>).mistakeReview
  return (
    adds(operations, 'attempted') &&
    adds(operations, 'correct') &&
    adds(levels, 'attempted') &&
    adds(levels, 'correct') &&
    // Mistake practice is a part of the whole, so it can never be more.
    (review === undefined ||
      (isCounts(review) &&
        review.attempted <= value.attempted &&
        review.correct <= value.correct))
  )
}
