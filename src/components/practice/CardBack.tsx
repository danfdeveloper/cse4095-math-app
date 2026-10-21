import { useId, type Ref } from 'react'
import { explainQuestion } from '../../services/explanations'
import type { Question } from '../../types/question'
import { spokenEquation } from '../../utils/questionText'
import { Button } from '../common/Button'
import styles from './CardBack.module.css'

interface CardBackProps {
  question: Question
  selectedAnswer: number
  showExplanation: boolean
  /** True once a result is recorded, so only one can be chosen per attempt. */
  resultRecorded: boolean
  onReportResult: (selfReportedCorrect: boolean) => void
  /** Lets the card move keyboard focus to the revealed answer. */
  headingRef: Ref<HTMLHeadingElement>
}

export function CardBack({
  question,
  selectedAnswer,
  showExplanation,
  resultRecorded,
  onReportResult,
  headingRef,
}: CardBackProps) {
  const explanationId = useId()
  const explanation = showExplanation ? explainQuestion(question) : null

  return (
    <div className={styles.back}>
      <h2
        ref={headingRef}
        className={styles.answer}
        tabIndex={-1}
        aria-label={spokenEquation(question)}
      >
        {question.displayText} = {question.correctAnswer}
      </h2>
      <p className={styles.yourAnswer}>Your answer: {selectedAnswer}</p>
      {explanation && (
        <section className={styles.explanation} aria-labelledby={explanationId}>
          <h3 id={explanationId} className={styles.method}>
            How to solve it:{' '}
            <span className={styles.methodName}>{explanation.method}</span>
          </h3>
          <ol className={styles.steps}>
            {explanation.steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </section>
      )}
      <div className={styles.actions}>
        <Button disabled={resultRecorded} onClick={() => onReportResult(true)}>
          I Got It Right
        </Button>
        <Button
          variant="secondary"
          disabled={resultRecorded}
          onClick={() => onReportResult(false)}
        >
          I Got It Wrong
        </Button>
      </div>
    </div>
  )
}
