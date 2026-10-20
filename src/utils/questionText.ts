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

/** A one-sentence, kid-friendly reason the answer is what it is. */
export function explainQuestion({
  operation,
  firstOperand: a,
  secondOperand: b,
  correctAnswer,
}: QuestionParts & Pick<Question, 'correctAnswer'>): string {
  switch (operation) {
    case 'addition':
      return `Add ${a} and ${b} together to get ${correctAnswer}.`
    case 'subtraction':
      return `Take ${b} away from ${a} and you are left with ${correctAnswer}.`
    case 'multiplication':
      return `${a} × ${b} means ${a} ${a === 1 ? 'group' : 'groups'} of ${b}, which makes ${correctAnswer}.`
    case 'division':
      return `${a} ÷ ${b} asks how many ${b}s fit into ${a}. Since ${b} × ${correctAnswer} = ${a}, the answer is ${correctAnswer}.`
    default:
      throw new Error(`Unsupported operation: ${String(operation)}`)
  }
}
