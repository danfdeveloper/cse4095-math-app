import { useId } from 'react'
import { OPERATION_ACCENT } from '../../constants/accents'
import { OPERATION_INFO } from '../../constants/practice'
import type {
  MissedFact,
  MistakeStatistics,
  MostMissedOperation,
} from '../../services/mistakeStatistics'
import type { MistakePattern } from '../../types/mistake'
import {
  formatDay,
  formatDifficulty,
  formatFact,
  formatList,
} from '../../utils/format'
import { StatTiles } from '../common/StatTiles'
import styles from './MistakePractice.module.css'

interface MistakePracticeProps {
  summary: MistakeStatistics
  /** Mistakes still to practice, most missed first. */
  active: readonly MistakePattern[]
  mastered: readonly MistakePattern[]
  /** How many correct similar questions master a mistake, from the settings. */
  masteryThreshold: number
  /** False when nothing has been answered incorrectly yet. */
  hasMistakes: boolean
}

function times(count: number): string {
  return count === 1 ? 'once' : `${count} times`
}

/**
 * What the student has got wrong, and how the practice of it is going: the
 * totals, what is missed most, and every mistake in a list (specification
 * section 6.6, "Mistake Review Statistics").
 */
export function MistakePractice({
  summary,
  active,
  mastered,
  masteryThreshold,
  hasMistakes,
}: MistakePracticeProps) {
  return (
    <>
      <StatTiles
        tiles={[
          {
            label: 'Mistakes to practice',
            value: summary.active,
            accent: 'orange',
          },
          {
            label: 'Mistakes mastered',
            value: summary.mastered,
            accent: 'green',
          },
          {
            label: 'Similar questions practiced',
            value: summary.similarPracticed,
            accent: 'blue',
          },
          {
            label: 'Review questions answered correctly',
            value: summary.similarCorrect,
            accent: 'purple',
          },
        ]}
      />
      {hasMistakes ? (
        <>
          <MostMissed
            operation={summary.mostMissedOperation}
            facts={summary.missedFacts}
          />
          <MistakeDetails
            active={active}
            mastered={mastered}
            masteryThreshold={masteryThreshold}
          />
        </>
      ) : (
        <p className={styles.none}>
          No mistakes yet. Questions you get wrong will show up here.
        </p>
      )}
    </>
  )
}

function MostMissed({
  operation,
  facts,
}: {
  operation: MostMissedOperation | null
  facts: readonly MissedFact[]
}) {
  const headingId = useId()
  const names = operation
    ? formatList(operation.operations.map((op) => OPERATION_INFO[op].label))
    : null

  return (
    <section className={styles.block} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.subheading}>
        Most missed
      </h3>
      {operation !== null && names !== null && (
        <p className={styles.mostMissed}>
          <span className={styles.label}>Operation missed most: </span>
          <strong>{names}</strong>
          {operation.operations.length > 1 ? ', tied' : ''} (
          {times(operation.misses)}
          {operation.operations.length > 1 ? ' each' : ''})
        </p>
      )}
      {facts.length > 0 && (
        <>
          <p className={styles.label} id={`${headingId}-facts`}>
            Number facts missed most
          </p>
          <ol className={styles.facts} aria-labelledby={`${headingId}-facts`}>
            {facts.map((fact) => (
              <li
                key={`${fact.operation}:${fact.firstOperand}:${fact.secondOperand}`}
                className={styles.fact}
                data-accent={OPERATION_ACCENT[fact.operation]}
              >
                <span className={styles.factText}>
                  {formatFact(
                    fact.operation,
                    fact.firstOperand,
                    fact.secondOperand,
                    fact.correctAnswer,
                  )}
                </span>
                <span className={styles.factMisses}>
                  Missed {times(fact.misses)}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}

function MistakeDetails({
  active,
  mastered,
  masteryThreshold,
}: {
  active: readonly MistakePattern[]
  mastered: readonly MistakePattern[]
  masteryThreshold: number
}) {
  const headingId = useId()

  return (
    <section className={styles.block} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.subheading}>
        Your mistakes
      </h3>
      {active.length > 0 ? (
        <MistakeList mistakes={active} masteryThreshold={masteryThreshold} />
      ) : (
        <p className={styles.none}>
          You have no mistakes to practice right now. Great work!
        </p>
      )}
      {mastered.length > 0 ? (
        // A native disclosure: keyboard and screen reader behavior come from the browser.
        <details className={styles.mastered}>
          <summary className={styles.summary}>
            Mastered mistakes ({mastered.length})
          </summary>
          <MistakeList
            mistakes={mastered}
            masteryThreshold={masteryThreshold}
          />
        </details>
      ) : (
        <p className={styles.none}>
          Mistakes you master will be kept here, out of the way.
        </p>
      )}
    </section>
  )
}

function MistakeList({
  mistakes,
  masteryThreshold,
}: {
  mistakes: readonly MistakePattern[]
  masteryThreshold: number
}) {
  return (
    <ol className={styles.list}>
      {mistakes.map((mistake) => {
        // A threshold lowered since the answers were given can be below the progress.
        const progress = Math.min(mistake.similarCorrectCount, masteryThreshold)
        return (
          <li
            key={mistake.id}
            className={styles.item}
            data-accent={OPERATION_ACCENT[mistake.operation]}
          >
            <p className={styles.itemFact}>
              {formatFact(
                mistake.operation,
                mistake.firstOperand,
                mistake.secondOperand,
                mistake.correctAnswer,
              )}
            </p>
            <dl className={styles.details}>
              <Detail
                label="Level"
                value={formatDifficulty(mistake.difficulty)}
              />
              <Detail
                label="Times missed"
                value={String(mistake.incorrectCount)}
              />
              <Detail
                label="Review progress"
                value={
                  mistake.mastered ? (
                    'Mastered'
                  ) : (
                    <>
                      {progress} of {masteryThreshold}
                      <span className={styles.bar} aria-hidden="true">
                        <span
                          className={styles.fill}
                          style={{
                            width: `${(progress / masteryThreshold) * 100}%`,
                          }}
                        />
                      </span>
                    </>
                  )
                }
              />
              <Detail
                label="Last missed"
                value={
                  <time dateTime={mistake.lastIncorrectAt}>
                    {formatDay(mistake.lastIncorrectAt)}
                  </time>
                }
              />
            </dl>
          </li>
        )
      })}
    </ol>
  )
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={styles.detail}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{value}</dd>
    </div>
  )
}
