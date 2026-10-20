import { MAX_STORED_SESSIONS } from '../constants/settings'
import type { PracticeSession } from '../types/session'

/** Keeps only the most recent sessions (the list is oldest first). */
export function limitSessions(
  sessions: readonly PracticeSession[],
  max: number = MAX_STORED_SESSIONS,
): PracticeSession[] {
  return sessions.length > max
    ? sessions.slice(sessions.length - max)
    : [...sessions]
}

/** Adds a session, or replaces the saved copy of the same session in place. */
export function upsertSession(
  sessions: readonly PracticeSession[],
  session: PracticeSession,
): PracticeSession[] {
  const index = sessions.findIndex((saved) => saved.id === session.id)
  if (index === -1) return limitSessions([...sessions, session])

  const updated = [...sessions]
  updated[index] = session
  return updated
}

export function removeSession(
  sessions: readonly PracticeSession[],
  sessionId: string,
): PracticeSession[] {
  return sessions.filter((session) => session.id !== sessionId)
}
