import type { MathOperation, Question } from '../types/question'

type QuestionParts = Pick<
  Question,
  'operation' | 'firstOperand' | 'secondOperand'
>

const SPOKEN_OPERATOR: Record<MathOperation, string> = {
  addition: 'plus',
  subtraction: 'minus',
  multiplication: 'times',
  division: 'divided by',
}

/** The expression in words, for screen readers: "7 times 8". */
export function spokenExpression({
  operation,
  firstOperand,
  secondOperand,
}: QuestionParts): string {
  return `${firstOperand} ${SPOKEN_OPERATOR[operation]} ${secondOperand}`
}

/** The question in words, for screen readers: "What is 7 times 8?". */
export function spokenQuestion(question: QuestionParts): string {
  return `What is ${spokenExpression(question)}?`
}

/** The solved equation in words, for screen readers: "7 times 8 equals 56". */
export function spokenEquation(
  question: QuestionParts & Pick<Question, 'correctAnswer'>,
): string {
  return `${spokenExpression(question)} equals ${question.correctAnswer}`
}
