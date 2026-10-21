import { useId, type Ref } from 'react'
import { answerAccent } from '../../constants/accents'
import type { Question } from '../../types/question'
import { spokenQuestion } from '../../utils/questionText'
import { Button } from '../common/Button'
import { AnswerChoice } from './AnswerChoice'
import styles from './CardFront.module.css'

interface CardFrontProps {
  question: Question
  questionNumber: number
  /** Left out for continuous practice, which has no fixed length. */
  totalQuestions?: number
  selectedAnswer: number | null
  /** True once the card is flipped: the answer can no longer change. */
  locked: boolean
  onSelectAnswer: (value: number) => void
  onFlip: () => void
  /** Lets the card move keyboard focus to the question. */
  headingRef: Ref<HTMLHeadingElement>
}

export function CardFront({
  question,
  questionNumber,
  totalQuestions,
  selectedAnswer,
  locked,
  onSelectAnswer,
  onFlip,
  headingRef,
}: CardFrontProps) {
  const headingId = useId()
  const hintId = useId()

  return (
    <div className={styles.front}>
      <p className={styles.position}>
        {totalQuestions === undefined
          ? `Question ${questionNumber}`
          : `Question ${questionNumber} of ${totalQuestions}`}
      </p>
      {/* Says why this question was picked, for a question made from an earlier mistake. */}
      {question.source === 'mistake-review' && (
        <p className={styles.tag}>Mistake practice</p>
      )}
      <h2
        ref={headingRef}
        id={headingId}
        className={styles.question}
        tabIndex={-1}
        aria-label={spokenQuestion(question)}
      >
        {question.displayText} = ?
      </h2>
      <div className={styles.choices} role="group" aria-labelledby={headingId}>
        {question.choices.map((choice, position) => (
          <AnswerChoice
            key={choice}
            value={choice}
            accent={answerAccent(position)}
            selected={selectedAnswer === choice}
            disabled={locked}
            onSelect={onSelectAnswer}
          />
        ))}
      </div>
      <div className={styles.actions}>
        <Button
          onClick={onFlip}
          disabled={selectedAnswer === null}
          aria-describedby={selectedAnswer === null ? hintId : undefined}
        >
          Flip Card
        </Button>
        {/* Visible text, because a disabled button cannot be focused to read a hint. */}
        {selectedAnswer === null && (
          <p id={hintId} className={styles.hint}>
            Pick an answer to flip the card.
          </p>
        )}
      </div>
    </div>
  )
}
