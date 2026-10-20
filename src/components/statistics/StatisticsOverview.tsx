import type { StatisticsRow } from '../../services/statisticsService'
import { StatTiles } from '../common/StatTiles'

interface StatisticsOverviewProps {
  overall: StatisticsRow
}

/** The totals across everything practiced so far. */
export function StatisticsOverview({ overall }: StatisticsOverviewProps) {
  return (
    <StatTiles
      tiles={[
        { label: 'Questions attempted', value: overall.attempted },
        { label: 'Correct', value: overall.correct },
        { label: 'Incorrect', value: overall.incorrect },
        { label: 'Accuracy', value: `${overall.accuracy}%` },
      ]}
    />
  )
}
