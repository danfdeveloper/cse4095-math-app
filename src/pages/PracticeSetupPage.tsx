import { useId, useState, type SubmitEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Button } from '../components/common/Button'
import { DifficultySelector } from '../components/practice/DifficultySelector'
import { OperationSelector } from '../components/practice/OperationSelector'
import { ReviewModeSelector } from '../components/practice/ReviewModeSelector'
import { SessionLengthSelector } from '../components/practice/SessionLengthSelector'
import { usePracticeSession } from '../hooks/usePracticeSession'
import { useSettings } from '../hooks/useSettings'
import { activePatterns } from '../services/mistakePatterns'
import type { DifficultyLevel, MathOperation } from '../types/question'
import type {
  PracticeConfig,
  PracticeMode,
  SessionLength,
} from '../types/session'
import { isPracticeConfig } from '../utils/validation'
import styles from './PracticeSetupPage.module.css'

/**
 * Says what is still missing, or null when the session can start. A difficulty
 * level is always chosen, because the page starts from the saved default.
 * Practicing mistakes also needs a mistake that the choices cover.
 */
function getValidationMessage(
  operations: MathOperation[],
  mode: PracticeMode,
  matchingMistakes: number,
): string | null {
  if (operations.length === 0) return 'Choose at least one operation to start.'
  if (mode === 'mistake-review' && matchingMistakes === 0) {
    return 'You have no mistakes to practice for these choices. Try other operations or another level.'
  }
  return null
}

export function PracticeSetupPage() {
  const navigate = useNavigate()
  const { startSession, mistakePatterns } = usePracticeSession()
  const { settings } = useSettings()
  const messageId = useId()

  // The page starts from the defaults saved on the settings page. Changing
  // them here only changes this session. Coming from a session summary
  // ("Change Settings"), it starts from that session's choices instead.
  const { state } = useLocation()
  const [previous] = useState(() => {
    const config = (state as { config?: unknown } | null)?.config
    return isPracticeConfig(config) ? config : null
  })
  const [operations, setOperations] = useState<MathOperation[]>(() => [
    ...(previous?.operations ?? settings.defaultOperations),
  ])
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(
    previous?.difficulty ?? settings.defaultDifficulty,
  )
  const [sessionLength, setSessionLength] = useState<SessionLength>(
    previous?.sessionLength ?? settings.defaultSessionLength,
  )
  // Practicing mistakes is only on offer while there are some to practice.
  const activeMistakes = activePatterns(mistakePatterns).length
  const [mode, setMode] = useState<PracticeMode>(
    previous?.mode === 'mistake-review' && activeMistakes > 0
      ? 'mistake-review'
      : 'regular',
  )
  const matchingMistakes = activePatterns(mistakePatterns, {
    operations,
    difficulty,
  }).length

  const validationMessage = getValidationMessage(
    operations,
    mode,
    matchingMistakes,
  )

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()

    // startSession refuses a setup that cannot start (no operation, or no
    // mistake for a review), so this needs no checks of its own.
    const config: PracticeConfig = {
      operations,
      difficulty,
      sessionLength,
      ...(mode === 'mistake-review' ? { mode } : {}),
    }
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
        <ReviewModeSelector
          value={mode}
          onChange={setMode}
          activeMistakes={activeMistakes}
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
