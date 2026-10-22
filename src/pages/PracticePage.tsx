import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Navigate, useBlocker } from 'react-router'
import { Button } from '../components/common/Button'
import { EndSessionDialog } from '../components/practice/EndSessionDialog'
import { FeedbackMessage } from '../components/practice/FeedbackMessage'
import { LeaveSessionDialog } from '../components/practice/LeaveSessionDialog'
import { ProgressBar } from '../components/practice/ProgressBar'
import { QuestionCard } from '../components/practice/QuestionCard'
import { usePracticeSession } from '../hooks/usePracticeSession'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { useSettings } from '../hooks/useSettings'
import { useStorageStatus } from '../hooks/useStorageStatus'
import {
  feedbackKindForResult,
  pickFeedback,
  type FeedbackKind,
} from '../services/feedback'
import { playSound } from '../services/sounds'
import type { CardProgress, QuestionResult } from '../types/session'
import styles from './PracticePage.module.css'

/** Said to a screen reader, and shown, when a session is brought back after the page was closed or refreshed. */
const WELCOME_BACK = 'Welcome back! Your session is right where you left it.'

export function PracticePage() {
  const {
    session,
    currentQuestion,
    currentQuestionIndex,
    card,
    isActive,
    restoredSessionId,
    recordResult,
    rememberCard,
    endSession,
    discardSession,
  } = usePracticeSession()
  const { settings } = useSettings()
  const { problem } = useStorageStatus()
  // The device's wish for less motion wins over the app's own setting.
  const prefersReducedMotion = usePrefersReducedMotion()
  const [confirmingEnd, setConfirmingEnd] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  // Shown until the first answer after the session was brought back.
  const [welcomeBack, setWelcomeBack] = useState(
    () => session !== null && session.id === restoredSessionId,
  )
  // Opened with no session at all (by typing the address, or a bookmark): the
  // setup page says why the student landed there. A session thrown away here
  // also leaves none, but then the student knows why.
  const [openedWithoutSession] = useState(session === null)
  // True once the student has chosen to go somewhere else: nothing is shown meanwhile, and no redirect competes.
  const [leaving, setLeaving] = useState(false)
  // The cheerful message for the question just answered. It stays until the next answer replaces it.
  const [feedback, setFeedback] = useState<{
    kind: FeedbackKind
    message: string
    id: number
  } | null>(null)
  // Said with the next question's announcement, so that a screen reader hears one thing, in order.
  const spokenLeadIn = useRef(welcomeBack ? WELCOME_BACK : '')

  // Going somewhere else in the app asks first, while a session is in progress. What
  // the session is read from here when the question is asked, and kept up to date before
  // any redirect of this page's own runs, so that finishing a session never asks.
  const inProgress = useRef(isActive)
  useLayoutEffect(() => {
    inProgress.current = isActive
  }, [isActive])
  const blocker = useBlocker(
    useCallback(
      ({
        currentLocation,
        nextLocation,
      }: {
        currentLocation: { pathname: string }
        nextLocation: { pathname: string }
      }) =>
        inProgress.current &&
        currentLocation.pathname !== nextLocation.pathname,
      [],
    ),
  )

  // Closing or refreshing the page loses nothing while the session is being
  // saved, so the browser is not asked to warn. When it cannot be saved, it would be lost.
  useEffect(() => {
    if (problem === null) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [problem])

  if (leaving) return null

  // Opened without a session (by typing the address, or after a refresh).
  if (session === null) {
    return (
      <Navigate
        to="/practice/setup"
        replace
        state={openedWithoutSession ? { missing: 'session' } : undefined}
      />
    )
  }
  // The session just ended, or has already ended: show how it went.
  if (session.completedAt !== undefined) {
    return <Navigate to="/practice/summary" replace />
  }
  if (currentQuestion === null) {
    return (
      <Navigate to="/practice/setup" replace state={{ missing: 'session' }} />
    )
  }

  const totalQuestions =
    session.sessionLength === 'continuous' ? undefined : session.sessionLength

  const currentQuestionId = currentQuestion.id
  function handleCardChange(progress: CardProgress) {
    rememberCard(currentQuestionId, progress)
  }

  function handleLeave() {
    setLeaving(true)
    // Nothing answered: nothing to keep. Otherwise the session ends, as if it had been ended here.
    if (session?.attempted === 0) discardSession()
    else endSession()
    if (blocker.state === 'blocked') blocker.proceed()
  }

  function handleResult(result: QuestionResult) {
    setWelcomeBack(false)
    recordResult(result)
    if (!settings.feedbackEffectsEnabled) return
    const kind = feedbackKindForResult(result.selfReportedCorrect)
    const message = pickFeedback(kind, feedback?.message)
    setFeedback({ kind, message, id: (feedback?.id ?? 0) + 1 })
    spokenLeadIn.current = message
  }

  function handleAnnounce(message: string) {
    setAnnouncement(`${spokenLeadIn.current} ${message}`.trim())
    spokenLeadIn.current = ''
  }

  function handleEndSession() {
    // Nothing answered yet: there is nothing to keep or to ask about.
    if (session?.attempted === 0) {
      discardSession()
      return
    }
    setConfirmingEnd(true)
  }

  return (
    <div className={styles.stage}>
      <h1 className="visually-hidden">Practice</h1>
      {/* Always on the page, so that what is put in it is read out. */}
      <div aria-live="polite" aria-atomic="true" className="visually-hidden">
        {announcement}
      </div>
      {welcomeBack && <p className={styles.welcome}>{WELCOME_BACK}</p>}
      {totalQuestions !== undefined && (
        <div className={styles.progress}>
          <ProgressBar
            value={session.attempted}
            max={totalQuestions}
            label="Session progress"
            valueText={`${session.attempted} of ${totalQuestions} questions answered`}
          />
        </div>
      )}
      {feedback && (
        <FeedbackMessage
          key={feedback.id}
          kind={feedback.kind}
          message={feedback.message}
        />
      )}
      <QuestionCard
        question={currentQuestion}
        questionNumber={currentQuestionIndex + 1}
        totalQuestions={totalQuestions}
        animationEnabled={
          settings.cardAnimationEnabled && !prefersReducedMotion
        }
        onAnnounce={handleAnnounce}
        showExplanation={settings.showExplanations}
        onResult={handleResult}
        initialCard={card}
        onCardChange={handleCardChange}
        onSound={settings.soundEffectsEnabled ? playSound : undefined}
      />
      {totalQuestions === undefined && (
        <>
          <div className={styles.endRow}>
            <Button variant="secondary" onClick={handleEndSession}>
              End Session
            </Button>
          </div>
          <EndSessionDialog
            open={confirmingEnd}
            answered={session.attempted}
            onKeepPracticing={() => setConfirmingEnd(false)}
            onEnd={() => {
              setConfirmingEnd(false)
              endSession()
            }}
          />
        </>
      )}
      <LeaveSessionDialog
        open={blocker.state === 'blocked'}
        answered={session.attempted}
        onKeepPracticing={() => blocker.state === 'blocked' && blocker.reset()}
        onLeave={handleLeave}
      />
    </div>
  )
}
