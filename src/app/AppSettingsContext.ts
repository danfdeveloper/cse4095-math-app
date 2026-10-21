import { createContext } from 'react'
import type { AppSettings } from '../types/settings'

export interface AppSettingsApi {
  settings: AppSettings
  /** Changes some settings. Anything invalid is replaced by its default. */
  updateSettings: (changes: Partial<AppSettings>) => void
  /**
   * Erases everything the app saved (settings, sessions, attempts, statistics
   * and mistake patterns) and starts over as on a first visit, ending any
   * session in progress. Returns false, and changes nothing, if the saved data
   * could not be erased.
   */
  clearAllData: () => boolean
}

export const AppSettingsContext = createContext<AppSettingsApi | null>(null)
