import { OPERATION_ACCENT } from '../../constants/accents'
import { OPERATION_INFO } from '../../constants/practice'
import type { OperationRow } from '../../services/statisticsService'
import styles from './StatisticsGrid.module.css'
import { StatisticsCard } from './StatisticsCard'

interface OperationStatisticsProps {
  rows: readonly OperationRow[]
}

/** One card for each operation: addition, subtraction, multiplication, division. */
export function OperationStatistics({ rows }: OperationStatisticsProps) {
  return (
    <div className={styles.grid}>
      {rows.map((row) => (
        <StatisticsCard
          key={row.operation}
          title={OPERATION_INFO[row.operation].label}
          symbol={OPERATION_INFO[row.operation].symbol}
          accent={OPERATION_ACCENT[row.operation]}
          counts={row}
        />
      ))}
    </div>
  )
}
