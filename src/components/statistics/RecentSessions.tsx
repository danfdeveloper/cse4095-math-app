import { OPERATION_INFO } from '../../constants/practice'
import type { RecentSessionRow } from '../../services/statisticsService'
import {
  formatDifficulty,
  formatList,
  formatSessionDate,
} from '../../utils/format'
import styles from './RecentSessions.module.css'

interface RecentSessionsProps {
  sessions: readonly RecentSessionRow[]
}

/** The most recent sessions, newest first. */
export function RecentSessions({ sessions }: RecentSessionsProps) {
  if (sessions.length === 0) {
    return <p className={styles.none}>No recent sessions to show yet.</p>
  }

  return (
    <ol className={styles.list}>
      {sessions.map((session) => (
        <li key={session.id} className={styles.item}>
          <div className={styles.heading}>
            <time className={styles.date} dateTime={session.startedAt}>
              {formatSessionDate(session.startedAt)}
            </time>
            {session.inProgress ? (
              <span className={styles.tag}>In progress</span>
            ) : (
              !session.finished && (
                <span className={styles.tag}>Not finished</span>
              )
            )}
          </div>
          <dl className={styles.details}>
            <Detail
              label="Operations"
              value={formatList(
                session.operations.map((op) => OPERATION_INFO[op].label),
              )}
            />
            <Detail
              label="Difficulty"
              value={formatDifficulty(session.difficulty)}
            />
            <Detail label="Questions attempted" value={session.attempted} />
            <Detail label="Correct" value={session.correct} />
            <Detail label="Incorrect" value={session.incorrect} />
            <Detail label="Accuracy" value={`${session.accuracy}%`} />
          </dl>
        </li>
      ))}
    </ol>
  )
}

function Detail({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={styles.detail}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{value}</dd>
    </div>
  )
}
