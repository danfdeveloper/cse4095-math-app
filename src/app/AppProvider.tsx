import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useSaveOnChange } from '../hooks/useSaveOnChange'
import {
  eraseSavedData,
  loadPersistedData,
  type PersistedData,
  saveActiveSession,
  saveAttempts,
  saveMistakePatterns,
  saveSessions,
  saveSettings,
  saveStatistics,
  type StorageProblem,
} from '../services/persistence'
import { patternsAfterAnswer } from '../services/mistakePatterns'
import {
  generateNextQuestion,
  generateQuestionForOperations,
} from '../services/questionGenerator'
import {
  generateReviewQuestion,
  recentQuestionsOf,
} from '../services/reviewQuestions'
import {
  STORAGE_KEYS,
  STORAGE_PREFIX,
  type WriteFailure,
  type WriteResult,
} from '../services/storageService'
import type { Question } from '../types/question'
import type {
  CardProgress,
  PracticeConfig,
  QuestionResult,
  SavedActiveSession,
} from '../types/session'
import type { AppSettings } from '../types/settings'
import { logDevError } from '../utils/devLog'
import { upsertSession } from '../utils/sessionHistory'
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

type SavedItem =
  | 'settings'
  | 'sessions'
  | 'attempts'
  | 'statistics'
  | 'mistakePatterns'
  | 'activeSession'

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

/**
 * The question `make` gives, or null if it throws. Making questions falls back
 * to a safe question rather than fail, so this is a last guard: a session that
 * cannot have a question does not start, or ends, and the app carries on.
 */
function questionOrNull(make: () => Question | null): Question | null {
  try {
    return make()
  } catch (error) {
    logDevError('No question could be made.', error)
    return null
  }
}

/** The practice state a visit starts from: what was saved, with the session that was in progress. */
function stateFromSaved(loaded: PersistedData): PracticeSessionState {
  const base: PracticeSessionState = {
    ...initialPracticeSessionState,
    sessions: loaded.sessions,
    attempts: loaded.attempts,
    statistics: loaded.statistics,
    mistakePatterns: loaded.mistakePatterns,
  }
  const active = loaded.activeSession
  if (active === null) return base

  return {
    ...base,
    session: active.session,
    currentQuestion: active.currentQuestion,
    currentQuestionIndex: active.session.attempted,
    card: active.card,
    // The session counts as one of the saved ones as soon as it has an answer.
    sessions:
      active.session.attempted > 0
        ? upsertSession(loaded.sessions, active.session)
        : loaded.sessions,
  }
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
  const [loaded, setLoaded] = useState(loadPersistedData)
  const [settings, setSettings] = useState<AppSettings>(loaded.settings)
  const [state, dispatch] = useReducer(
    practiceSessionReducer,
    initialState ?? stateFromSaved(loaded),
  )
  // The session brought back from the last visit, so that its page can say so.
  const [restoredSessionId] = useState(
    () => loaded.activeSession?.session.id ?? null,
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

  // What was just read back from storage after another tab saved. It is
  // already saved, so it is not written again: that would be wasted work, and
  // could set the tabs answering each other.
  const fromStorage = useRef(new WeakSet<object>())

  // Another tab (or window) of the app saved something. Catch up with it, so
  // that this tab's next save adds to what the other saved instead of writing
  // over it. This tab's own session in progress is kept.
  useEffect(() => {
    function catchUp(event: StorageEvent) {
      const { key } = event
      const ours =
        key === null ||
        (key.startsWith(STORAGE_PREFIX) && key !== STORAGE_KEYS.activeSession)
      if (!ours) return

      const latest = loadPersistedData({ activeSession: false })
      if (latest.problem !== null) return
      const { attempts, sessions, statistics, mistakePatterns } = latest
      for (const value of [attempts, sessions, statistics, mistakePatterns]) {
        fromStorage.current.add(value)
      }
      fromStorage.current.add(latest.settings)
      setSettings((current) =>
        JSON.stringify(current) === JSON.stringify(latest.settings)
          ? current
          : latest.settings,
      )
      dispatch({
        type: 'historyLoaded',
        attempts,
        sessions,
        statistics,
        mistakePatterns,
      })
    }
    window.addEventListener('storage', catchUp)
    return () => window.removeEventListener('storage', catchUp)
  }, [])

  useSaveOnChange(
    settings,
    useCallback(
      (value: AppSettings) => {
        if (!fromStorage.current.has(value)) {
          persist('settings', () => saveSettings(value))
        }
      },
      [persist],
    ),
  )
  useSaveOnChange(
    state.attempts,
    useCallback(
      (value: PracticeSessionState['attempts']) => {
        if (!fromStorage.current.has(value)) {
          persist('attempts', () => saveAttempts(value))
        }
      },
      [persist],
    ),
  )
  useSaveOnChange(
    state.sessions,
    useCallback(
      (value: PracticeSessionState['sessions']) => {
        if (!fromStorage.current.has(value)) {
          persist('sessions', () => saveSessions(value))
        }
      },
      [persist],
    ),
  )

  useSaveOnChange(
    state.statistics,
    useCallback(
      (value: PracticeSessionState['statistics']) => {
        if (!fromStorage.current.has(value)) {
          persist('statistics', () => saveStatistics(value))
        }
      },
      [persist],
    ),
  )

  useSaveOnChange(
    state.mistakePatterns,
    useCallback(
      (value: PracticeSessionState['mistakePatterns']) => {
        if (!fromStorage.current.has(value)) {
          persist('mistakePatterns', () => saveMistakePatterns(value))
        }
      },
      [persist],
    ),
  )

  // What a refresh needs to bring the session back: the session, its question, and the card.
  const { session, currentQuestion, card } = state
  const activeSnapshot = useMemo<SavedActiveSession | null>(
    () =>
      session !== null &&
      session.completedAt === undefined &&
      currentQuestion !== null
        ? { session, currentQuestion, card }
        : null,
    [session, currentQuestion, card],
  )
  useSaveOnChange(
    activeSnapshot,
    useCallback(
      (value: SavedActiveSession | null) =>
        persist('activeSession', () => saveActiveSession(value)),
      [persist],
    ),
  )

  const { masteryThreshold } = settings

  const startSession = useCallback(
    (config: PracticeConfig): boolean => {
      if (!isPracticeConfig(config)) return false

      // A review session asks about the mistakes its choices cover. With none
      // to practice there is nothing to start.
      const firstQuestion = questionOrNull(() =>
        config.mode === 'mistake-review'
          ? generateReviewQuestion(state.mistakePatterns, config, {
              threshold: masteryThreshold,
              now: new Date(),
            })
          : generateQuestionForOperations(config.operations, config.difficulty),
      )
      if (firstQuestion === null) return false

      dispatch({
        type: 'sessionStarted',
        session: createSession(config),
        firstQuestion,
      })
      return true
    },
    [state.mistakePatterns, masteryThreshold],
  )

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

      const attempt = createAttempt(session, currentQuestion, result)
      dispatch({
        type: 'resultRecorded',
        attempt,
        // No question is made after the last one of a fixed session. If one
        // cannot be made at all, the session ends here, keeping this answer.
        nextQuestion: isFinalQuestion(session)
          ? null
          : questionOrNull(() =>
              session.mode === 'mistake-review'
                ? // Chosen from the mistakes as this answer leaves them. When none still
                  // need practice (the last was just mastered) there is no next question,
                  // and the session ends.
                  generateReviewQuestion(
                    patternsAfterAnswer(
                      state.mistakePatterns,
                      currentQuestion,
                      attempt,
                      masteryThreshold,
                    ),
                    session,
                    {
                      threshold: masteryThreshold,
                      now: new Date(),
                      previousPatternId: currentQuestion.mistakePatternId,
                      recent: recentQuestionsOf(
                        session,
                        state.attempts,
                        currentQuestion,
                      ),
                    },
                  )
                : generateNextQuestion(
                    session.operations,
                    session.difficulty,
                    currentQuestion,
                  ),
            ),
        masteryThreshold,
      })
    },
    [state, masteryThreshold],
  )

  const rememberCard = useCallback((questionId: string, card: CardProgress) => {
    dispatch({ type: 'cardChanged', questionId, card })
  }, [])

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

  const clearAllData = useCallback((): boolean => {
    if (!eraseSavedData()) return false

    // Loading from the emptied storage is exactly a first visit: the defaults,
    // the version stamped again, and saving switched back on even if the old
    // data had been left alone because it came from a newer version.
    const fresh = loadPersistedData()
    setLoaded(fresh)
    setSettings(fresh.settings)
    dispatch({ type: 'historyReset' })
    // Saving problems clear themselves: every item is saved again, and each
    // successful save removes that item's problem.
    return true
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
      restoredSessionId,
      startSession,
      recordResult,
      rememberCard,
      endSession,
      discardSession,
      resetStatistics,
    }),
    [
      state,
      restoredSessionId,
      startSession,
      recordResult,
      rememberCard,
      endSession,
      discardSession,
      resetStatistics,
    ],
  )
  const settingsApi = useMemo<AppSettingsApi>(
    () => ({ settings, updateSettings, clearAllData }),
    [settings, updateSettings, clearAllData],
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
