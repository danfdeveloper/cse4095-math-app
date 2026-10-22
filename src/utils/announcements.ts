import type { Question } from '../types/question'

/**
 * What a screen reader is told as practice goes on (specification section 14).
 * Focus already moves to the question and to the answer, which reads them out,
 * so these add what focus does not: where the student is in the session, what
 * was picked, and what turning the card over showed.
 */

interface QuestionPosition {
  /** One-based. */
  questionNumber: number
  /** Left out for continuous practice. */
  totalQuestions?: number
  /** A question made from an earlier mistake. */
  mistakePractice?: boolean
}

/** Said when a new question appears: how far along the session is. */
export function announceQuestion({
  questionNumber,
  totalQuestions,
  mistakePractice = false,
}: QuestionPosition): string {
  const answered = questionNumber - 1
  const place =
    totalQuestions === undefined
      ? `Question ${questionNumber}. ${answered} answered so far.`
      : `Question ${questionNumber} of ${totalQuestions}. ${answered} of ${totalQuestions} answered.`
  return mistakePractice ? `Mistake practice. ${place}` : place
}

/** Said when an answer is picked from the keyboard, where nothing else would say so. */
export function announcePick(answer: number, position: number): string {
  return `You picked ${answer}, answer ${position}. Press Enter to flip the card.`
}

/**
 * Said when the card is turned over: what was chosen, and the right answer.
 * It does not say whether the choice was right, as the student does that.
 * Focus lands on the equation, which reads it out in full.
 */
export function announceReveal(
  question: Pick<Question, 'correctAnswer'>,
  selectedAnswer: number,
): string {
  return `Card turned over. You chose ${selectedAnswer}. The correct answer is ${question.correctAnswer}.`
}
