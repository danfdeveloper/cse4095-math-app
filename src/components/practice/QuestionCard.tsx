import { useEffect, useRef, useState } from 'react'
import type { Question } from '../../types/question'
import type { QuestionResult } from '../../types/session'
import { CardBack } from './CardBack'
import { CardFront } from './CardFront'
import styles from './QuestionCard.module.css'

interface QuestionCardProps {
  question: Question
  questionNumber: number
  /** Left out for continuous practice. */
  totalQuestions?: number
  /** Turn the flip animation off. It is also off whenever the device asks for reduced motion. */
  animationEnabled?: boolean
  showExplanation?: boolean
  /** Called once, when the student says whether they got the question right. */
  onResult: (result: QuestionResult) => void
}

/**
 * One flip card: choose an answer on the front, flip it, then say on the back
 * whether you got it right. Choosing and flipping are kept here, and they
 * start over whenever the question changes.
 */
export function QuestionCard(props: QuestionCardProps) {
  return <QuestionCardBody key={props.question.id} {...props} />
}

function QuestionCardBody({
  question,
  questionNumber,
  totalQuestions,
  animationEnabled = true,
  showExplanation = true,
  onResult,
}: QuestionCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [isCardFlipped, setIsCardFlipped] = useState(false)
  const [resultRecorded, setResultRecorded] = useState(false)
  // The state above updates after a render, so a quick double click could
  // report twice. The ref closes that gap.
  const recordedRef = useRef(false)

  const frontHeadingRef = useRef<HTMLHeadingElement>(null)
  const backHeadingRef = useRef<HTMLHeadingElement>(null)

  // Keyboard focus would be lost when a button disappears, so move it to the
  // question when a card appears and to the answer when it is flipped.
  useEffect(() => {
    frontHeadingRef.current?.focus({ preventScroll: true })
  }, [])
  useEffect(() => {
    if (isCardFlipped) backHeadingRef.current?.focus({ preventScroll: true })
  }, [isCardFlipped])

  function handleSelectAnswer(value: number) {
    if (isCardFlipped) return
    setSelectedAnswer(value)
  }

  function handleFlip() {
    if (selectedAnswer === null) return
    setIsCardFlipped(true)
  }

  function handleReportResult(selfReportedCorrect: boolean) {
    if (selectedAnswer === null || !isCardFlipped || recordedRef.current) return
    recordedRef.current = true
    setResultRecorded(true)
    onResult({ selectedAnswer, selfReportedCorrect })
  }

  const faceClass = (hidden: boolean) =>
    `${styles.face} ${hidden ? styles.inactive : ''}`

  return (
    <div
      className={`${styles.card} ${animationEnabled ? '' : styles.noAnimation}`}
      data-flipped={isCardFlipped}
      data-animated={animationEnabled}
    >
      <div className={`${styles.inner} ${isCardFlipped ? styles.flipped : ''}`}>
        {/* The face that is turned away is hidden from assistive technology and skipped by Tab. */}
        <div
          className={faceClass(isCardFlipped)}
          aria-hidden={isCardFlipped}
          inert={isCardFlipped}
        >
          <CardFront
            question={question}
            questionNumber={questionNumber}
            totalQuestions={totalQuestions}
            selectedAnswer={selectedAnswer}
            locked={isCardFlipped}
            onSelectAnswer={handleSelectAnswer}
            onFlip={handleFlip}
            headingRef={frontHeadingRef}
          />
        </div>
        <div
          className={`${faceClass(!isCardFlipped)} ${styles.back}`}
          aria-hidden={!isCardFlipped}
          inert={!isCardFlipped}
        >
          {selectedAnswer !== null && (
            <CardBack
              question={question}
              selectedAnswer={selectedAnswer}
              showExplanation={showExplanation}
              resultRecorded={resultRecorded}
              onReportResult={handleReportResult}
              headingRef={backHeadingRef}
            />
          )}
        </div>
      </div>
    </div>
  )
}
