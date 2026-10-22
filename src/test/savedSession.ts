import type { PracticeSessionState } from '../app/practiceSessionState'
import { STORAGE_KEYS } from '../services/storageService'

/**
 * Leaves in storage what the app saves for a session in progress, as a page
 * that was refreshed or closed would have left it, so that the next render
 * brings it back through the real loader.
 */
export function saveSessionInProgress(
  state: PracticeSessionState,
  card: PracticeSessionState['card'] = state.card,
) {
  const { session, currentQuestion } = state
  window.localStorage.setItem(
    STORAGE_KEYS.activeSession,
    JSON.stringify({ session, currentQuestion, card }),
  )
  window.localStorage.setItem(
    STORAGE_KEYS.attempts,
    JSON.stringify(state.attempts),
  )
  window.localStorage.setItem(
    STORAGE_KEYS.sessions,
    JSON.stringify(state.sessions),
  )
}
