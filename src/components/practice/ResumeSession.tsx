import { useId, useState } from 'react'
import { useNavigate } from 'react-router'
import { OPERATION_INFO } from '../../constants/practice'
import { usePracticeSession } from '../../hooks/usePracticeSession'
import {
  formatDifficulty,
  formatList,
  formatQuestionCount,
} from '../../utils/format'
import { Button, ButtonLink } from '../common/Button'
import { EndSessionDialog } from './EndSessionDialog'
import styles from './ResumeSession.module.css'

/**
 * Offers to carry on with a session that is still in progress, which on the
 * home page means one that was brought back after the page was closed or
 * refreshed. Shows nothing when there is none.
 */
export function ResumeSession() {
  const { session, isActive, endSession, discardSession } = usePracticeSession()
  const navigate = useNavigate()
  const [confirmingEnd, setConfirmingEnd] = useState(false)
  const headingId = useId()

  if (!isActive || session === null) return null

  const operations = formatList(
    session.operations.map((operation) => OPERATION_INFO[operation].label),
  )
  const progress =
    session.sessionLength === 'continuous'
      ? `${formatQuestionCount(session.attempted)} answered so far`
      : `${session.attempted} of ${session.sessionLength} questions answered`

  function handleEnd() {
    // Nothing answered yet: there is nothing to keep or to ask about.
    if (session?.attempted === 0) {
      discardSession()
      return
    }
    setConfirmingEnd(true)
  }

  return (
    <section
      className={styles.resume}
      data-accent="indigo"
      aria-labelledby={headingId}
    >
      <h2 id={headingId} className={styles.heading}>
        Pick up where you left off
      </h2>
      <p className={styles.details}>
        {session.mode === 'mistake-review' ? 'Mistake practice: ' : ''}
        {operations}, {formatDifficulty(session.difficulty)}. {progress}.
      </p>
      <div className={styles.actions}>
        <ButtonLink to="/practice/session">Continue Session</ButtonLink>
        <Button variant="secondary" onClick={handleEnd}>
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
          navigate('/practice/summary')
        }}
      />
    </section>
  )
}
