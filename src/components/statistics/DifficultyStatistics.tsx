import type { DifficultyRow } from '../../services/statisticsService'
import { formatDifficulty } from '../../utils/format'
import styles from './StatisticsGrid.module.css'
import { StatisticsCard } from './StatisticsCard'

interface DifficultyStatisticsProps {
  rows: readonly DifficultyRow[]
}

/** One card for each level, clearly labelled, such as "Level 2: Easy". */
export function DifficultyStatistics({ rows }: DifficultyStatisticsProps) {
  return (
    <div className={styles.grid}>
      {rows.map((row) => (
        <StatisticsCard
          key={row.difficulty}
          title={formatDifficulty(row.difficulty)}
          counts={row}
        />
      ))}
    </div>
  )
}
