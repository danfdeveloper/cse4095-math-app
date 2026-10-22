import { useEffect, useRef, useState } from 'react'
import { useAnswerShortcuts } from '../../hooks/useAnswerShortcuts'
import type { Question } from '../../types/question'
import type { SoundEffect } from '../../services/sounds'
import type { CardProgress, QuestionResult } from '../../types/session'
import {
  announcePick,
  announceQuestion,
  announceReveal,
} from '../../utils/announcements'
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
  /**
   * Where to say, for screen readers, how far along the session is and what has
   * happened to the card. Focus moves to the question and the answer, which read
   * those out, so this adds what focus does not.
   */
  onAnnounce?: (message: string) => void
  /**
   * Where the card starts when it is brought back after a refresh: the answer
   * that was picked, and whether the card was turned over. A new question
   * starts with nothing picked.
   */
  initialCard?: CardProgress
  /** Called when an answer is picked or the card is turned over, so that it can be kept. */
  onCardChange?: (card: CardProgress) => void
  /** Plays a sound for what the student just did. Left out when sound effects are off. */
  onSound?: (effect: SoundEffect) => void
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
  onAnnounce,
  initialCard,
  onCardChange,
  onSound,
}: QuestionCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(
    initialCard?.selectedAnswer ?? null,
  )
  const [isCardFlipped, setIsCardFlipped] = useState(
    initialCard?.flipped ?? false,
  )
  // A card brought back already turned over: it is announced and focused as such when it appears.
  const startedFlipped = useRef(initialCard?.flipped ?? false)
  const [resultRecorded, setResultRecorded] = useState(false)
  // The state above updates after a render, so a quick double click could
  // report twice. The ref closes that gap.
  const recordedRef = useRef(false)

  // Counts the answers picked with the number keys, so that each one moves focus on.
  const [keyPicks, setKeyPicks] = useState(0)

  const frontHeadingRef = useRef<HTMLHeadingElement>(null)
  const backHeadingRef = useRef<HTMLHeadingElement>(null)
  const flipRef = useRef<HTMLButtonElement>(null)

  // The latest announcer, so a new function from the parent does not announce again.
  const announce = useRef(onAnnounce)
  useEffect(() => {
    announce.current = onAnnounce
  }, [onAnnounce])

  // The same for the keeper of the card's progress.
  const keepCard = useRef(onCardChange)
  useEffect(() => {
    keepCard.current = onCardChange
  }, [onCardChange])
  useEffect(() => {
    keepCard.current?.({ selectedAnswer, flipped: isCardFlipped })
  }, [selectedAnswer, isCardFlipped])

  // Keyboard focus would be lost when a button disappears, so move it to the
  // question when a card appears and to the answer when it is flipped.
  useEffect(() => {
    const turned = startedFlipped.current && selectedAnswer !== null
    const heading = turned ? backHeadingRef : frontHeadingRef
    heading.current?.focus({ preventScroll: true })
    const asked = announceQuestion({
      questionNumber,
      totalQuestions,
      mistakePractice: question.source === 'mistake-review',
    })
    // Brought back turned over, it says so along with the question, as one thing.
    announce.current?.(
      turned ? `${asked} ${announceReveal(question, selectedAnswer)}` : asked,
    )
    // A card is one question, so this runs once for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    // One brought back already turned over was dealt with when it appeared.
    if (!isCardFlipped || startedFlipped.current) return
    backHeadingRef.current?.focus({ preventScroll: true })
    if (selectedAnswer !== null) {
      announce.current?.(announceReveal(question, selectedAnswer))
    }
    // Only turning the card over says this; the answer cannot change after.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCardFlipped])

  // After an answer is picked with a number key, the next thing to do is flip the card.
  useEffect(() => {
    if (keyPicks > 0) flipRef.current?.focus({ preventScroll: true })
  }, [keyPicks])

  // The number keys 1 to 4 pick the choices in the order they are shown.
  useAnswerShortcuts({
    enabled: !isCardFlipped,
    count: question.choices.length,
    onChoose: (position) => {
      const answer = question.choices[position]
      setSelectedAnswer(answer)
      setKeyPicks((count) => count + 1)
      onSound?.('pick')
      announce.current?.(announcePick(answer, position + 1))
    },
  })

  function handleSelectAnswer(value: number) {
    if (isCardFlipped) return
    setSelectedAnswer(value)
    onSound?.('pick')
  }

  function handleFlip() {
    if (selectedAnswer === null) return
    setIsCardFlipped(true)
    onSound?.('flip')
  }

  function handleReportResult(selfReportedCorrect: boolean) {
    if (selectedAnswer === null || !isCardFlipped || recordedRef.current) return
    recordedRef.current = true
    setResultRecorded(true)
    onSound?.(selfReportedCorrect ? 'right' : 'wrong')
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
            flipRef={flipRef}
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
