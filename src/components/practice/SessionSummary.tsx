import { OPERATION_INFO } from '../../constants/practice'
import type { SessionSummaryData } from '../../services/statisticsService'
import type { PracticeSession } from '../../types/session'
import { formatDifficulty, formatList } from '../../utils/format'
import { StatTiles } from '../common/StatTiles'
import styles from './SessionSummary.module.css'

interface SessionSummaryProps {
  session: PracticeSession
  summary: SessionSummaryData
}

/** The results of one practice session: the totals, accuracy, and what was practiced. */
export function SessionSummary({ session, summary }: SessionSummaryProps) {
  const operations = formatList(
    session.operations.map((operation) => OPERATION_INFO[operation].label),
  )

  return (
    <section className={styles.summary} aria-label="Results">
      <StatTiles
        tiles={[
          {
            label: 'Questions attempted',
            value: summary.attempted,
            accent: 'blue',
          },
          { label: 'Correct', value: summary.correct, accent: 'green' },
          { label: 'Incorrect', value: summary.incorrect, accent: 'orange' },
          {
            label: 'Accuracy',
            value: `${summary.accuracy}%`,
            accent: 'purple',
          },
        ]}
      />
      <dl className={styles.details}>
        <Detail label="Operations practiced" value={operations} />
        <Detail
          label="Difficulty"
          value={formatDifficulty(session.difficulty)}
        />
        <Detail
          label="Mistake-review questions"
          value={String(summary.mistakeReviewCount)}
        />
      </dl>
    </section>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.detail}>
      <dt className={styles.detailLabel}>{label}</dt>
      <dd className={styles.detailValue}>{value}</dd>
    </div>
  )
}
