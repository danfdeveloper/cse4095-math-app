import { useContext } from 'react'
import {
  AppSettingsContext,
  type AppSettingsApi,
} from '../app/AppSettingsContext'

/** The app's settings and how to change them. Must be used inside AppProvider. */
export function useSettings(): AppSettingsApi {
  const api = useContext(AppSettingsContext)
  if (api === null) {
    throw new Error('useSettings must be used inside <AppProvider>')
  }
  return api
}
