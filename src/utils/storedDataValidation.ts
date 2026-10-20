import {
  createDefaultSettings,
  DEFAULT_SETTINGS,
  MASTERY_THRESHOLD_RANGE,
} from '../constants/settings'
import type { MathOperation } from '../types/question'
import type { PracticeAttempt, PracticeSession } from '../types/session'
import type { AppSettings } from '../types/settings'
import type { AppStatistics, OperationStatistics } from '../types/statistics'
import { DIFFICULTY_LEVELS, MATH_OPERATIONS } from '../constants/practice'
import { isDifficultyLevel, isSupportedOperation } from './validation'

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
    isCount(value.attempted) &&
    isCount(value.correct) &&
    isCount(value.incorrect) &&
    // The totals must add up, or the record cannot be trusted.
    value.correct + value.incorrect === value.attempted
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
export function isAppStatistics(value: unknown): value is AppStatistics {
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
  return (
    adds(operations, 'attempted') &&
    adds(operations, 'correct') &&
    adds(levels, 'attempted') &&
    adds(levels, 'correct')
  )
}
