import { useState } from 'react'
import { Button, ButtonLink } from '../components/common/Button'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { EmptyState } from '../components/common/EmptyState'
import { DifficultyStatistics } from '../components/statistics/DifficultyStatistics'
import { OperationStatistics } from '../components/statistics/OperationStatistics'
import { RecentSessions } from '../components/statistics/RecentSessions'
import { StatisticsOverview } from '../components/statistics/StatisticsOverview'
import { usePracticeSession } from '../hooks/usePracticeSession'
import { useStatistics } from '../hooks/useStatistics'
import styles from './StatisticsPage.module.css'

export function StatisticsPage() {
  const view = useStatistics()
  const { resetStatistics } = usePracticeSession()
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [justReset, setJustReset] = useState(false)

  return (
    <>
      <h1>Statistics</h1>
      {/* Always present, so the message is announced when it fills in. */}
      <p role="status" className={styles.status}>
        {justReset ? 'Your practice history and statistics were erased.' : ''}
      </p>

      {view.hasData ? (
        <>
          <section className={styles.section} aria-labelledby="overall-heading">
            <h2 id="overall-heading">Overall</h2>
            <StatisticsOverview overall={view.overall} />
          </section>
          <section
            className={styles.section}
            aria-labelledby="operations-heading"
          >
            <h2 id="operations-heading">By operation</h2>
            <OperationStatistics rows={view.byOperation} />
          </section>
          <section className={styles.section} aria-labelledby="levels-heading">
            <h2 id="levels-heading">By difficulty</h2>
            <DifficultyStatistics rows={view.byDifficulty} />
          </section>
          <section className={styles.section} aria-labelledby="recent-heading">
            <h2 id="recent-heading">Recent sessions</h2>
            <RecentSessions sessions={view.recentSessions} />
          </section>
        </>
      ) : (
        <EmptyState
          title="No practice yet"
          message="Finish a practice session and your progress will show up here."
          action={<ButtonLink to="/practice/setup">Start Practice</ButtonLink>}
        />
      )}

      <div className={styles.reset}>
        <Button variant="secondary" onClick={() => setConfirmingReset(true)}>
          Reset Statistics
        </Button>
        <p className={styles.note}>Your settings will stay the same.</p>
      </div>

      <ConfirmDialog
        open={confirmingReset}
        title="Reset statistics?"
        message="Are you sure you want to erase all practice history and statistics?"
        confirmLabel="Yes, Erase It"
        cancelLabel="No, Keep It"
        onCancel={() => setConfirmingReset(false)}
        onConfirm={() => {
          setConfirmingReset(false)
          resetStatistics()
          setJustReset(true)
        }}
      />
    </>
  )
}
