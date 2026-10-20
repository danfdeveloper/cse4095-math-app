import type { Ref } from 'react'
import type { Question } from '../../types/question'
import { explainQuestion, spokenEquation } from '../../utils/questionText'
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
      {showExplanation && (
        <p className={styles.explanation}>{explainQuestion(question)}</p>
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
