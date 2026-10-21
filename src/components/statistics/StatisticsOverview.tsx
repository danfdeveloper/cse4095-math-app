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
        {
          label: 'Questions attempted',
          value: overall.attempted,
          accent: 'blue',
        },
        { label: 'Correct', value: overall.correct, accent: 'green' },
        { label: 'Incorrect', value: overall.incorrect, accent: 'orange' },
        {
          label: 'Accuracy',
          value: `${overall.accuracy}%`,
          accent: 'purple',
        },
      ]}
    />
  )
}
