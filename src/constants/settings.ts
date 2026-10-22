import type { AppSettings } from '../types/settings'
import { DEFAULT_SESSION_LENGTH } from './practice'

/**
 * What the app uses when nothing has been saved. Sound is off by default: a
 * quiet start suits a classroom, and a student can turn it on in Settings. No operations are preselected,
 * so the setup page still asks the student to choose.
 */
export const DEFAULT_SETTINGS: AppSettings = {
  soundEffectsEnabled: false,
  cardAnimationEnabled: true,
  showExplanations: true,
  feedbackEffectsEnabled: true,
  defaultSessionLength: DEFAULT_SESSION_LENGTH,
  defaultDifficulty: 1,
  defaultOperations: [],
  masteryThreshold: 3,
}

/** A fresh copy of the defaults, so changing it can never change DEFAULT_SETTINGS. */
export function createDefaultSettings(): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    defaultOperations: [...DEFAULT_SETTINGS.defaultOperations],
  }
}

/** Mastery needs at least one, and no more than this many, correct similar questions. */
export const MASTERY_THRESHOLD_RANGE = { min: 1, max: 10 } as const

/**
 * How many answered questions are kept in detail (specification section 23).
 * Older ones are archived: their details are dropped, but they stay counted in
 * the saved totals and in the mistakes they made. At about 330 characters each
 * (660 bytes, as browsers keep text), the whole of the saved data stays under
 * 3.5 MB, inside the 5 MB the strictest browsers allow a site.
 */
export const MAX_STORED_ATTEMPTS = 5000

/** How many recent sessions are kept in saved history. Older ones are dropped. */
export const MAX_STORED_SESSIONS = 100
