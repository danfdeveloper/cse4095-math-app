import { useContext } from 'react'
import {
  PracticeSessionContext,
  type PracticeSessionApi,
} from '../app/PracticeSessionContext'

/** The practice session and the actions that change it. Must be used inside AppProvider. */
export function usePracticeSession(): PracticeSessionApi {
  const api = useContext(PracticeSessionContext)
  if (api === null) {
    throw new Error('usePracticeSession must be used inside <AppProvider>')
  }
  return api
}
