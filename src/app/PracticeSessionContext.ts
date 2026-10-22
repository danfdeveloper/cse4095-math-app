import { createContext } from 'react'
import type {
  CardProgress,
  PracticeConfig,
  QuestionResult,
} from '../types/session'
import type { PracticeSessionState } from './practiceSessionState'

export interface PracticeSessionApi extends PracticeSessionState {
  /** Whether a session is in progress (not yet ended). */
  isActive: boolean
  /** The session brought back from the last visit, if there was one, so that its page can say so. */
  restoredSessionId: string | null
  /** Begins a session. Returns false, and does nothing, if the setup is not valid. */
  startSession: (config: PracticeConfig) => boolean
  /** Keeps what has been done with the question on screen, so that a refresh can bring it back. */
  rememberCard: (questionId: string, card: CardProgress) => void
  /** Records the student's report for the question on screen and moves on. */
  recordResult: (result: QuestionResult) => void
  /** Ends the session, keeping what was answered so far. */
  endSession: () => void
  /** Drops the session and its attempts, for leaving before answering anything. */
  discardSession: () => void
  /** Erases all practice history and statistics. Settings are not touched. */
  resetStatistics: () => void
}

export const PracticeSessionContext = createContext<PracticeSessionApi | null>(
  null,
)
