import type { AppSettings } from '../types/settings'
import { DEFAULT_SESSION_LENGTH } from './practice'

/**
 * What the app uses when nothing has been saved. Sound is off by default: nothing
 * plays yet, and a quiet start suits a classroom. No operations are preselected,
 * so the setup page still asks the student to choose.
 */
export const DEFAULT_SETTINGS: AppSettings = {
  soundEffectsEnabled: false,
  cardAnimationEnabled: true,
  showExplanations: true,
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

/** How many recent sessions are kept in saved history. Older ones are dropped. */
export const MAX_STORED_SESSIONS = 100
