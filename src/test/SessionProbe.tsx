import { usePracticeSession } from '../hooks/usePracticeSession'

/**
 * Test-only: exposes the shared practice state to tests. It is kept in a data
 * attribute rather than printed as text, so it can never be matched by a text
 * query (a random id such as "…bad…" once tripped a check for unkind words).
 */
export function SessionProbe() {
  const { session, currentQuestion, currentQuestionIndex, attempts, isActive } =
    usePracticeSession()

  return (
    <div
      data-testid="session-probe"
      aria-hidden="true"
      hidden
      data-state={JSON.stringify({
        session,
        currentQuestionId: currentQuestion?.id ?? null,
        currentQuestionIndex,
        attempts,
        isActive,
      })}
    />
  )
}
