import { useMemo } from 'react'
import {
  buildStatisticsView,
  type StatisticsView,
} from '../services/statisticsService'
import { usePracticeSession } from './usePracticeSession'

/** Everything the statistics page shows, worked out from the saved totals and sessions. */
export function useStatistics(): StatisticsView {
  const { statistics, sessions, session, isActive } = usePracticeSession()
  const activeSessionId = isActive && session !== null ? session.id : null

  return useMemo(
    () => buildStatisticsView(statistics, sessions, activeSessionId),
    [statistics, sessions, activeSessionId],
  )
}
