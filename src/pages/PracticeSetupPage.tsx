import { useId, useState, type SubmitEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Button } from '../components/common/Button'
import { DifficultySelector } from '../components/practice/DifficultySelector'
import { OperationSelector } from '../components/practice/OperationSelector'
import { SessionLengthSelector } from '../components/practice/SessionLengthSelector'
import { DEFAULT_SESSION_LENGTH } from '../constants/practice'
import { usePracticeSession } from '../hooks/usePracticeSession'
import type { DifficultyLevel, MathOperation } from '../types/question'
import type { PracticeConfig, SessionLength } from '../types/session'
import { isPracticeConfig } from '../utils/validation'
import styles from './PracticeSetupPage.module.css'

/** Says what is still missing, or null when the session can start. */
function getValidationMessage(
  operations: MathOperation[],
  difficulty: DifficultyLevel | null,
): string | null {
  if (operations.length === 0 && difficulty === null) {
    return 'Choose at least one operation and a difficulty level to start.'
  }
  if (operations.length === 0) {
    return 'Choose at least one operation to start.'
  }
  if (difficulty === null) {
    return 'Choose a difficulty level to start.'
  }
  return null
}

export function PracticeSetupPage() {
  const navigate = useNavigate()
  const { startSession } = usePracticeSession()
  const messageId = useId()

  // A fresh visit preselects nothing except the session length. Saved defaults
  // from the settings page are applied here later (Task 49). Coming from a
  // session summary ("Change Settings"), it starts from that session's choices.
  const { state } = useLocation()
  const [previous] = useState(() => {
    const config = (state as { config?: unknown } | null)?.config
    return isPracticeConfig(config) ? config : null
  })
  const [operations, setOperations] = useState<MathOperation[]>(
    previous?.operations ?? [],
  )
  const [difficulty, setDifficulty] = useState<DifficultyLevel | null>(
    previous?.difficulty ?? null,
  )
  const [sessionLength, setSessionLength] = useState<SessionLength>(
    previous?.sessionLength ?? DEFAULT_SESSION_LENGTH,
  )

  const validationMessage = getValidationMessage(operations, difficulty)

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (difficulty === null || operations.length === 0) return

    const config: PracticeConfig = { operations, difficulty, sessionLength }
    if (startSession(config)) navigate('/practice/session')
  }

  return (
    <>
      <h1>Practice Setup</h1>
      <p className={styles.intro}>
        Choose what you want to practice, then press Start Session.
      </p>
      <form className={styles.form} onSubmit={handleSubmit}>
        <OperationSelector selected={operations} onChange={setOperations} />
        <DifficultySelector value={difficulty} onChange={setDifficulty} />
        <SessionLengthSelector
          value={sessionLength}
          onChange={setSessionLength}
        />
        <div className={styles.actions}>
          <Button
            type="submit"
            disabled={validationMessage !== null}
            aria-describedby={validationMessage ? messageId : undefined}
          >
            Start Session
          </Button>
          {/* Visible text, because a disabled button cannot be focused to read a hint. */}
          {validationMessage && (
            <p id={messageId} role="status" className={styles.message}>
              {validationMessage}
            </p>
          )}
        </div>
      </form>
    </>
  )
}
