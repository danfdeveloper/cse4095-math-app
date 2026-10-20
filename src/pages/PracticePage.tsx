import { useState } from 'react'
import { Navigate } from 'react-router'
import { Button } from '../components/common/Button'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { ProgressBar } from '../components/practice/ProgressBar'
import { QuestionCard } from '../components/practice/QuestionCard'
import { usePracticeSession } from '../hooks/usePracticeSession'
import { useSettings } from '../hooks/useSettings'
import styles from './PracticePage.module.css'

export function PracticePage() {
  const {
    session,
    currentQuestion,
    currentQuestionIndex,
    recordResult,
    endSession,
    discardSession,
  } = usePracticeSession()
  const { settings } = useSettings()
  const [confirmingEnd, setConfirmingEnd] = useState(false)

  // Opened without a session (by typing the address, or after a refresh).
  if (session === null) return <Navigate to="/practice/setup" replace />
  // The session just ended, or has already ended: show how it went.
  if (session.completedAt !== undefined) {
    return <Navigate to="/practice/summary" replace />
  }
  if (currentQuestion === null) return <Navigate to="/practice/setup" replace />

  const totalQuestions =
    session.sessionLength === 'continuous' ? undefined : session.sessionLength

  function handleEndSession() {
    // Nothing answered yet: there is nothing to keep or to ask about.
    if (session?.attempted === 0) {
      discardSession()
      return
    }
    setConfirmingEnd(true)
  }

  return (
    <>
      <h1 className="visually-hidden">Practice</h1>
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
      <QuestionCard
        question={currentQuestion}
        questionNumber={currentQuestionIndex + 1}
        totalQuestions={totalQuestions}
        animationEnabled={settings.cardAnimationEnabled}
        showExplanation={settings.showExplanations}
        onResult={recordResult}
      />
      {totalQuestions === undefined && (
        <>
          <div className={styles.endRow}>
            <Button variant="secondary" onClick={handleEndSession}>
              End Session
            </Button>
          </div>
          <ConfirmDialog
            open={confirmingEnd}
            title="End this session?"
            message={`You have answered ${session.attempted} ${session.attempted === 1 ? 'question' : 'questions'} so far. Do you want to stop and see how you did?`}
            confirmLabel="End Session"
            cancelLabel="Keep Practicing"
            onCancel={() => setConfirmingEnd(false)}
            onConfirm={() => {
              setConfirmingEnd(false)
              endSession()
            }}
          />
        </>
      )}
    </>
  )
}
