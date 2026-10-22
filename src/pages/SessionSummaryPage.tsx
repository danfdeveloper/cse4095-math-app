import { useEffect, useMemo, useRef } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Button, ButtonLink } from '../components/common/Button'
import { SessionSummary } from '../components/practice/SessionSummary'
import { usePracticeSession } from '../hooks/usePracticeSession'
import { useSessionCheer } from '../hooks/useSessionCheer'
import { activePatterns } from '../services/mistakePatterns'
import { summarizeSession } from '../services/statisticsService'
import type { PracticeConfig, PracticeSession } from '../types/session'
import styles from './SessionSummaryPage.module.css'

export function SessionSummaryPage() {
  const { session } = usePracticeSession()

  // Nothing to summarize: no session yet, or the page was opened by typing the address.
  if (session === null) {
    return (
      <Navigate to="/practice/setup" replace state={{ missing: 'summary' }} />
    )
  }
  // Still practicing: back to the questions.
  if (session.completedAt === undefined) {
    return <Navigate to="/practice/session" replace />
  }
  return <SummaryContent session={session} />
}

function SummaryContent({ session }: { session: PracticeSession }) {
  const { attempts, mistakePatterns, startSession } = usePracticeSession()
  const navigate = useNavigate()
  const headingRef = useRef<HTMLHeadingElement>(null)
  // Goes through every saved attempt, so it is worked out again only when they change.
  const summary = useMemo(
    () => summarizeSession(session, attempts),
    [session, attempts],
  )
  const cheer = useSessionCheer(summary.attempted, summary.accuracy)

  // The card the student was using is gone, so keyboard focus would be lost.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])

  const config: PracticeConfig = {
    operations: session.operations,
    difficulty: session.difficulty,
    sessionLength: session.sessionLength,
    ...(session.mode === undefined ? {} : { mode: session.mode }),
  }
  const wasReview = session.mode === 'mistake-review'
  // The mistakes this session's choices cover that still need practice.
  const mistakesToPractice = activePatterns(mistakePatterns, session).length
  const nothingToReview = mistakesToPractice === 0

  function handlePracticeAgain() {
    if (startSession(config)) navigate('/practice/session')
  }

  function handlePracticeMistakes() {
    if (startSession({ ...config, mode: 'mistake-review' })) {
      navigate('/practice/session')
    }
  }

  // Said in words beside the buttons that depend on it, as a disabled button cannot explain itself.
  const mistakesNote = nothingToReview
    ? wasReview
      ? 'Great work! You have mastered every mistake for these choices.'
      : 'You have no mistakes to practice for these choices yet.'
    : `You have ${mistakesToPractice} ${mistakesToPractice === 1 ? 'mistake' : 'mistakes'} to practice for these choices.`
  return (
    <>
      <h1 ref={headingRef} tabIndex={-1} className={styles.heading}>
        Session Summary
      </h1>
      <p className={styles.intro}>
        {cheer === null ? '' : `${cheer} `}Here is how you did.
      </p>
      <SessionSummary session={session} summary={summary} />
      <div className={styles.actions}>
        <Button
          onClick={handlePracticeAgain}
          disabled={wasReview && nothingToReview}
          aria-describedby={
            wasReview && nothingToReview ? 'practice-mistakes-note' : undefined
          }
        >
          Practice Again
        </Button>
        <Button
          variant="secondary"
          onClick={handlePracticeMistakes}
          disabled={nothingToReview}
          aria-describedby="practice-mistakes-note"
        >
          Practice Mistakes
        </Button>
        <ButtonLink to="/practice/setup" state={{ config }} variant="secondary">
          Change Settings
        </ButtonLink>
        <ButtonLink to="/statistics" variant="secondary">
          View Statistics
        </ButtonLink>
        <ButtonLink to="/" variant="secondary">
          Return Home
        </ButtonLink>
      </div>
      <p id="practice-mistakes-note" className={styles.note}>
        {mistakesNote}
      </p>
    </>
  )
}
