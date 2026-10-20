import { createContext } from 'react'
import type { AppSettings } from '../types/settings'

export interface AppSettingsApi {
  settings: AppSettings
  /** Changes some settings. Anything invalid is replaced by its default. */
  updateSettings: (changes: Partial<AppSettings>) => void
}

export const AppSettingsContext = createContext<AppSettingsApi | null>(null)
