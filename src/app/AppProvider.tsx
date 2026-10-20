import {
  useCallback,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react'
import { useSaveOnChange } from '../hooks/useSaveOnChange'
import {
  loadPersistedData,
  saveAttempts,
  saveSessions,
  saveSettings,
  saveStatistics,
  type StorageProblem,
} from '../services/persistence'
import {
  generateNextQuestion,
  generateQuestionForOperations,
} from '../services/questionGenerator'
import type { WriteFailure, WriteResult } from '../services/storageService'
import type { PracticeConfig, QuestionResult } from '../types/session'
import type { AppSettings } from '../types/settings'
import { sanitizeSettings } from '../utils/storedDataValidation'
import { isPracticeConfig } from '../utils/validation'
import { AppSettingsContext, type AppSettingsApi } from './AppSettingsContext'
import {
  PracticeSessionContext,
  type PracticeSessionApi,
} from './PracticeSessionContext'
import {
  createAttempt,
  createSession,
  initialPracticeSessionState,
  isFinalQuestion,
  isSessionActive,
  practiceSessionReducer,
  type PracticeSessionState,
} from './practiceSessionState'
import {
  StorageStatusContext,
  type StorageStatusApi,
} from './StorageStatusContext'

interface AppProviderProps {
  children: ReactNode
  /**
   * Where the practice session starts, instead of what was saved. Used by tests.
   * Settings are always the saved ones.
   */
  initialState?: PracticeSessionState
}

type SavedItem = 'settings' | 'sessions' | 'attempts' | 'statistics'

interface StorageStatus {
  /**
   * The latest failure of each thing that is saved. An item is removed when it
   * saves successfully again, and not before: one item saving fine says nothing
   * about another. (A nearly full disk fails the big attempts list while small
   * writes still work.)
   */
  failures: Partial<Record<SavedItem, WriteFailure>>
  /** The problem the student pressed OK on, so it is not shown again. */
  dismissedProblem: StorageProblem | null
}

/** The most important problem among the failures, if there are any. */
function problemFrom(
  failures: StorageStatus['failures'],
): StorageProblem | null {
  const reasons = Object.values(failures)
  if (reasons.includes('unavailable')) return 'unavailable'
  if (reasons.includes('full')) return 'full'
  return null
}

/**
 * Holds the practice session and the settings for the whole app, loads what
 * was saved last time, and saves changes as they happen. The session reducer
 * is pure; the parts that are not (IDs, the clock, random questions, storage)
 * are done here.
 */
export function AppProvider({ children, initialState }: AppProviderProps) {
  const [loaded] = useState(loadPersistedData)
  const [settings, setSettings] = useState<AppSettings>(loaded.settings)
  const [state, dispatch] = useReducer(
    practiceSessionReducer,
    initialState ?? {
      ...initialPracticeSessionState,
      sessions: loaded.sessions,
      attempts: loaded.attempts,
      statistics: loaded.statistics,
    },
  )
  const [status, setStatus] = useState<StorageStatus>({
    failures: {},
    dismissedProblem: null,
  })
  // A problem found while loading (storage off, or data from a newer version)
  // stays for the whole visit; saving problems come and go.
  const problem = loaded.problem ?? problemFrom(status.failures)

  // Saving never stops practice: a failure is shown as a warning and the app
  // carries on in memory. The warning clears once the item that failed saves.
  const persist = useCallback(
    (item: SavedItem, write: () => WriteResult) => {
      if (!loaded.writable) return
      const result = write()
      setStatus((current) => {
        const failures = { ...current.failures }
        if (result.ok) delete failures[item]
        else failures[item] = result.reason
        if (failures[item] === current.failures[item]) return current

        return {
          failures,
          // Once nothing is wrong, a problem that returns is shown afresh.
          dismissedProblem:
            problemFrom(failures) === null ? null : current.dismissedProblem,
        }
      })
    },
    [loaded.writable],
  )

  useSaveOnChange(
    settings,
    useCallback(
      (value: AppSettings) => persist('settings', () => saveSettings(value)),
      [persist],
    ),
  )
  useSaveOnChange(
    state.attempts,
    useCallback(
      (value: PracticeSessionState['attempts']) =>
        persist('attempts', () => saveAttempts(value)),
      [persist],
    ),
  )
  useSaveOnChange(
    state.sessions,
    useCallback(
      (value: PracticeSessionState['sessions']) =>
        persist('sessions', () => saveSessions(value)),
      [persist],
    ),
  )

  useSaveOnChange(
    state.statistics,
    useCallback(
      (value: PracticeSessionState['statistics']) =>
        persist('statistics', () => saveStatistics(value)),
      [persist],
    ),
  )

  const startSession = useCallback((config: PracticeConfig): boolean => {
    if (!isPracticeConfig(config)) return false

    dispatch({
      type: 'sessionStarted',
      session: createSession(config),
      firstQuestion: generateQuestionForOperations(
        config.operations,
        config.difficulty,
      ),
    })
    return true
  }, [])

  const recordResult = useCallback(
    (result: QuestionResult) => {
      const { session, currentQuestion } = state
      if (
        !isSessionActive(state) ||
        session === null ||
        currentQuestion === null
      ) {
        return
      }

      dispatch({
        type: 'resultRecorded',
        attempt: createAttempt(session, currentQuestion, result),
        // No question is made after the last one of a fixed session.
        nextQuestion: isFinalQuestion(session)
          ? null
          : generateNextQuestion(
              session.operations,
              session.difficulty,
              currentQuestion,
            ),
      })
    },
    [state],
  )

  const endSession = useCallback(() => {
    dispatch({ type: 'sessionEnded', completedAt: new Date().toISOString() })
  }, [])

  const discardSession = useCallback(() => {
    dispatch({ type: 'sessionDiscarded' })
  }, [])

  const resetStatistics = useCallback(() => {
    dispatch({ type: 'historyReset' })
  }, [])

  const updateSettings = useCallback((changes: Partial<AppSettings>) => {
    setSettings((current) => sanitizeSettings({ ...current, ...changes }))
  }, [])

  const dismiss = useCallback(() => {
    setStatus((current) => ({
      ...current,
      dismissedProblem: loaded.problem ?? problemFrom(current.failures),
    }))
  }, [loaded.problem])

  const sessionApi = useMemo<PracticeSessionApi>(
    () => ({
      ...state,
      isActive: isSessionActive(state),
      startSession,
      recordResult,
      endSession,
      discardSession,
      resetStatistics,
    }),
    [
      state,
      startSession,
      recordResult,
      endSession,
      discardSession,
      resetStatistics,
    ],
  )
  const settingsApi = useMemo<AppSettingsApi>(
    () => ({ settings, updateSettings }),
    [settings, updateSettings],
  )
  const statusApi = useMemo<StorageStatusApi>(
    () => ({
      problem,
      dismissed: problem !== null && status.dismissedProblem === problem,
      dismiss,
    }),
    [problem, status.dismissedProblem, dismiss],
  )

  return (
    <StorageStatusContext value={statusApi}>
      <AppSettingsContext value={settingsApi}>
        <PracticeSessionContext value={sessionApi}>
          {children}
        </PracticeSessionContext>
      </AppSettingsContext>
    </StorageStatusContext>
  )
}
