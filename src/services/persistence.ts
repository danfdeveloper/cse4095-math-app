import { createDefaultSettings } from '../constants/settings'
import type { MistakePattern } from '../types/mistake'
import type {
  PracticeAttempt,
  PracticeSession,
  SavedActiveSession,
} from '../types/session'
import type { AppSettings } from '../types/settings'
import type { AppStatistics } from '../types/statistics'
import { limitAttempts, limitSessions } from '../utils/sessionHistory'
import {
  isAppStatistics,
  isMistakePattern,
  isPracticeAttempt,
  isPracticeSession,
  keepValidRecords,
  sanitizeSettings,
} from '../utils/storedDataValidation'
import { restoreActiveSession } from './activeSession'
import {
  rebuildMistakePatterns,
  withoutDuplicatePatterns,
} from './mistakePatterns'
import {
  createEmptyStatistics,
  statisticsFromAttempts,
} from './statisticsService'
import { prepareStorage } from './storageMigrations'
import {
  clearAppData,
  getStorage,
  readRawJson,
  removeKeys,
  STORAGE_KEYS,
  writeJson,
  type StorageKey,
  type WriteResult,
} from './storageService'

/** Why saved data could not be used or saved normally. */
export type StorageProblem = 'unavailable' | 'full' | 'newer-version'

export interface PersistedData {
  settings: AppSettings
  sessions: PracticeSession[]
  attempts: PracticeAttempt[]
  statistics: AppStatistics
  mistakePatterns: MistakePattern[]
  /** The session that was in progress when the app was last closed, if it can be carried on. */
  activeSession: SavedActiveSession | null
  /** Set when something went wrong that the student should be told about. */
  problem: StorageProblem | null
  /** False when saving would fail or would overwrite data the app does not understand. */
  writable: boolean
}

function loadRecords<T>(
  key: StorageKey,
  isValid: (record: unknown) => record is T,
): { records: T[]; unavailable: boolean } {
  const result = readRawJson(key)
  if (result.status === 'unavailable') return { records: [], unavailable: true }
  if (result.status !== 'ok') return { records: [], unavailable: false }

  // Dropping a bad record, or resetting a list that is not a list, loses only that.
  return {
    records: keepValidRecords(result.value, isValid) ?? [],
    unavailable: false,
  }
}

/**
 * Everything the app saved last time, cleaned up. Always returns something
 * usable: if storage is off, full of rubbish, or too new, the app starts fresh.
 *
 * With `activeSession: false` the session in progress is neither read nor
 * tidied away. That is for catching up with another tab, whose session in
 * progress is its own business.
 */
export function loadPersistedData({
  activeSession: includeActive = true,
}: { activeSession?: boolean } = {}): PersistedData {
  const fresh: PersistedData = {
    settings: createDefaultSettings(),
    sessions: [],
    attempts: [],
    statistics: createEmptyStatistics(),
    mistakePatterns: [],
    activeSession: null,
    problem: null,
    writable: false,
  }

  const preparation = prepareStorage()
  if (preparation === 'unavailable') return { ...fresh, problem: 'unavailable' }
  if (preparation === 'newer-version')
    return { ...fresh, problem: 'newer-version' }

  const settings = readRawJson(STORAGE_KEYS.settings)
  const sessions = loadRecords(STORAGE_KEYS.sessions, isPracticeSession)
  const attempts = loadRecords(STORAGE_KEYS.attempts, isPracticeAttempt)
  const savedStatistics = readRawJson(STORAGE_KEYS.statistics)
  const savedPatterns = readRawJson(STORAGE_KEYS.mistakePatterns)
  const savedActive: ReturnType<typeof readRawJson> = includeActive
    ? readRawJson(STORAGE_KEYS.activeSession)
    : { status: 'missing' }

  if (
    settings.status === 'unavailable' ||
    sessions.unavailable ||
    attempts.unavailable ||
    savedStatistics.status === 'unavailable' ||
    savedPatterns.status === 'unavailable' ||
    savedActive.status === 'unavailable'
  ) {
    return { ...fresh, problem: 'unavailable' }
  }

  const activeSession =
    savedActive.status === 'ok'
      ? restoreActiveSession(savedActive.value, attempts.records)
      : null
  // Nothing that can be carried on: make sure nothing is left to be tried again.
  if (includeActive && activeSession === null) {
    removeKeys([STORAGE_KEYS.activeSession])
  }

  return {
    settings:
      settings.status === 'ok'
        ? sanitizeSettings(settings.value)
        : fresh.settings,
    sessions: limitSessions(sessions.records),
    attempts: limitAttempts(attempts.records),
    statistics: chooseStatistics(
      savedStatistics.status === 'ok' ? savedStatistics.value : null,
      attempts.records,
    ),
    mistakePatterns: chooseMistakePatterns(
      savedPatterns.status === 'ok' ? savedPatterns.value : null,
      attempts.records,
    ),
    activeSession,
    problem: null,
    writable: true,
  }
}

/**
 * The saved mistake patterns, with unusable records and repeats dropped. If
 * there is no saved list, or it is not a list at all (it was never saved, or
 * it was damaged), the patterns are worked out again from the saved attempts,
 * so that mistakes made before patterns were saved are not lost. A saved list
 * is trusted over the attempts, even an empty one.
 */
function chooseMistakePatterns(
  saved: unknown,
  attempts: readonly PracticeAttempt[],
): MistakePattern[] {
  const records = keepValidRecords(saved, isMistakePattern)
  return records === null
    ? rebuildMistakePatterns(attempts)
    : withoutDuplicatePatterns(records)
}

/**
 * The saved totals, unless they are missing or damaged, or have fallen behind
 * the saved attempts (a save that failed). The totals can never honestly be
 * lower than the number of attempts still stored, since attempts only leave
 * once they are counted in the totals. In those cases they are counted again
 * from the attempts.
 */
function chooseStatistics(
  saved: unknown,
  attempts: readonly PracticeAttempt[],
): AppStatistics {
  const counted = statisticsFromAttempts(attempts)
  if (isAppStatistics(saved) && saved.attempted >= attempts.length) {
    // Saved before mistake practice had totals of its own: count them from the attempts.
    return {
      ...saved,
      mistakeReview: saved.mistakeReview ?? counted.mistakeReview,
    }
  }
  return counted
}

/**
 * Erases everything the app saved. Returns false only when something saved
 * could not be removed. If storage is switched off nothing is saved, so there
 * is nothing left to erase and that counts as done.
 */
export function eraseSavedData(): boolean {
  if (getStorage() === null) return true
  return clearAppData()
}

export function saveSettings(settings: AppSettings): WriteResult {
  return writeJson(STORAGE_KEYS.settings, settings)
}

export function saveSessions(
  sessions: readonly PracticeSession[],
): WriteResult {
  return writeJson(STORAGE_KEYS.sessions, limitSessions(sessions))
}

export function saveAttempts(
  attempts: readonly PracticeAttempt[],
): WriteResult {
  return writeJson(STORAGE_KEYS.attempts, limitAttempts(attempts))
}

export function saveStatistics(statistics: AppStatistics): WriteResult {
  return writeJson(STORAGE_KEYS.statistics, statistics)
}

export function saveMistakePatterns(
  patterns: readonly MistakePattern[],
): WriteResult {
  return writeJson(STORAGE_KEYS.mistakePatterns, patterns)
}

/**
 * Saves the session in progress, or removes what was saved when there is none
 * (it ended, or was thrown away).
 */
export function saveActiveSession(
  active: SavedActiveSession | null,
): WriteResult {
  if (active === null) {
    return removeKeys([STORAGE_KEYS.activeSession])
      ? { ok: true }
      : { ok: false, reason: 'unavailable' }
  }
  return writeJson(STORAGE_KEYS.activeSession, active)
}
