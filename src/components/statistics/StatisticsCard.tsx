import { useId } from 'react'
import type { Accent } from '../../constants/accents'
import type { StatisticsRow } from '../../services/statisticsService'
import styles from './StatisticsCard.module.css'

interface StatisticsCardProps {
  title: string
  /** A decorative symbol beside the title; the title carries the meaning. */
  symbol?: string
  /** A colour for the card. It only decorates: the title says what it is. */
  accent?: Accent
  counts: StatisticsRow
}

/** The numbers for one operation or one level. */
export function StatisticsCard({
  title,
  symbol,
  accent,
  counts,
}: StatisticsCardProps) {
  const headingId = useId()

  return (
    <article
      className={styles.card}
      aria-labelledby={headingId}
      data-accent={accent}
    >
      <h3 id={headingId} className={styles.title}>
        {symbol && (
          <span className={styles.symbol} aria-hidden="true">
            {symbol}
          </span>
        )}
        {title}
      </h3>
      {counts.attempted === 0 ? (
        // Saying "0%" would suggest it went badly, when it just has not been tried.
        <p className={styles.none}>Not practiced yet</p>
      ) : (
        <dl className={styles.counts}>
          <Count label="Questions attempted" value={counts.attempted} />
          <Count label="Correct" value={counts.correct} />
          <Count label="Incorrect" value={counts.incorrect} />
          <Count label="Accuracy" value={`${counts.accuracy}%`} />
        </dl>
      )}
    </article>
  )
}

function Count({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={styles.count}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{value}</dd>
    </div>
  )
}
