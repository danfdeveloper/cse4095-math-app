import type { FeedbackKind } from '../../services/feedback'
import styles from './FeedbackMessage.module.css'

interface FeedbackMessageProps {
  kind: FeedbackKind
  message: string
}

/**
 * A short cheerful message. The words carry the meaning; the star or heart and
 * the colour only decorate. It is not a live region: screen readers hear the
 * message with the next question instead (see PracticePage), so it is said once.
 */
export function FeedbackMessage({ kind, message }: FeedbackMessageProps) {
  return (
    <p
      className={styles.message}
      data-kind={kind}
      data-accent={kind === 'praise' ? 'green' : 'blue'}
    >
      <span className={styles.symbol} aria-hidden="true">
        {kind === 'praise' ? '★' : '♥'}
      </span>
      {message}
    </p>
  )
}
