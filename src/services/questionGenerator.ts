import {
  ADDITION_RULES,
  DIVISION_RULES,
  MULTIPLICATION_RULES,
  quotientRangeFor,
  SUBTRACTION_RULES,
} from '../constants/difficultyRules'
import { OPERATION_INFO } from '../constants/practice'
import type {
  DifficultyLevel,
  MathOperation,
  Question,
} from '../types/question'
import { generateId } from '../utils/ids'
import { calculateAnswer, randomInt, type RandomSource } from '../utils/math'
import {
  getQuestionProblems,
  isDifficultyLevel,
  isSupportedOperation,
} from '../utils/validation'
import { buildChoices } from './answerChoices'

/** Thrown when a valid question cannot be produced. */
export class QuestionGenerationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'QuestionGenerationError'
  }
}

interface Operands {
  firstOperand: number
  secondOperand: number
}

function buildQuestion(
  operation: MathOperation,
  difficulty: DifficultyLevel,
  { firstOperand, secondOperand }: Operands,
  random: RandomSource,
): Question {
  const correctAnswer = calculateAnswer(operation, firstOperand, secondOperand)
  return {
    id: generateId(),
    operation,
    firstOperand,
    secondOperand,
    displayText: `${firstOperand} ${OPERATION_INFO[operation].symbol} ${secondOperand}`,
    correctAnswer,
    choices: buildChoices(
      { operation, firstOperand, secondOperand, correctAnswer },
      random,
    ),
    difficulty,
    source: 'regular',
  }
}

export function generateAdditionQuestion(
  difficulty: DifficultyLevel,
  random: RandomSource = Math.random,
): Question {
  const { operands, maxSum } = ADDITION_RULES[difficulty]
  const firstOperand = randomInt(operands.min, operands.max, random)
  // Cap the second number so the sum never passes the level's limit.
  const secondMax =
    maxSum === undefined
      ? operands.max
      : Math.min(operands.max, maxSum - firstOperand)
  const secondOperand = randomInt(operands.min, secondMax, random)

  return buildQuestion(
    'addition',
    difficulty,
    { firstOperand, secondOperand },
    random,
  )
}

export function generateSubtractionQuestion(
  difficulty: DifficultyLevel,
  random: RandomSource = Math.random,
): Question {
  const { operands } = SUBTRACTION_RULES[difficulty]
  const a = randomInt(operands.min, operands.max, random)
  const b = randomInt(operands.min, operands.max, random)

  // Larger number first, so the answer is never negative.
  return buildQuestion(
    'subtraction',
    difficulty,
    { firstOperand: Math.max(a, b), secondOperand: Math.min(a, b) },
    random,
  )
}

export function generateMultiplicationQuestion(
  difficulty: DifficultyLevel,
  random: RandomSource = Math.random,
): Question {
  const shapes = MULTIPLICATION_RULES[difficulty]
  const shape = shapes[randomInt(0, shapes.length - 1, random)]
  const a = randomInt(shape.first.min, shape.first.max, random)
  const b = randomInt(shape.second.min, shape.second.max, random)

  // Show the factors in either order, so "7 x 48" and "48 x 7" both appear.
  const swap = random() < 0.5
  return buildQuestion(
    'multiplication',
    difficulty,
    { firstOperand: swap ? b : a, secondOperand: swap ? a : b },
    random,
  )
}

export function generateDivisionQuestion(
  difficulty: DifficultyLevel,
  random: RandomSource = Math.random,
): Question {
  const rules = DIVISION_RULES[difficulty]
  const divisorRange =
    rules.divisors[randomInt(0, rules.divisors.length - 1, random)]
  // The divisor starts at 1 or higher, so division by zero cannot happen.
  const divisor = randomInt(divisorRange.min, divisorRange.max, random)
  const quotients = quotientRangeFor(rules, divisor)
  if (quotients === null) {
    throw new QuestionGenerationError(
      `No whole-number answer fits divisor ${divisor} at Level ${difficulty}`,
    )
  }

  // Pick the answer first and work back to the dividend (specification section 9).
  const quotient = randomInt(quotients.min, quotients.max, random)
  return buildQuestion(
    'division',
    difficulty,
    { firstOperand: divisor * quotient, secondOperand: divisor },
    random,
  )
}

const GENERATORS: Record<
  MathOperation,
  (difficulty: DifficultyLevel, random: RandomSource) => Question
> = {
  addition: generateAdditionQuestion,
  subtraction: generateSubtractionQuestion,
  multiplication: generateMultiplicationQuestion,
  division: generateDivisionQuestion,
}

/**
 * Generates one question for the operation and level, and checks it before
 * returning it. Throws QuestionGenerationError if that is not possible.
 */
export function generateQuestion(
  operation: MathOperation,
  difficulty: DifficultyLevel,
  random: RandomSource = Math.random,
): Question {
  if (!isSupportedOperation(operation)) {
    throw new QuestionGenerationError(
      `Unsupported operation: ${String(operation)}`,
    )
  }
  if (!isDifficultyLevel(difficulty)) {
    throw new QuestionGenerationError(
      `Unsupported difficulty level: ${String(difficulty)}`,
    )
  }

  let question: Question
  try {
    question = GENERATORS[operation](difficulty, random)
  } catch (error) {
    if (error instanceof QuestionGenerationError) throw error
    throw new QuestionGenerationError(
      `Could not generate a ${operation} question at Level ${difficulty}`,
      { cause: error },
    )
  }

  const problems = getQuestionProblems(question)
  if (problems.length > 0) {
    throw new QuestionGenerationError(
      `Generated an invalid question (${question.displayText}): ${problems.join('; ')}`,
    )
  }
  return question
}

/** How many times to draw again when a new question matches the previous one. */
export const MAX_REPEAT_RETRIES = 10

/**
 * Generates the next question for a session, avoiding an immediate repeat of
 * the one just answered. The retries are capped, so a source of randomness
 * that keeps returning the same question cannot cause an endless loop.
 */
export function generateNextQuestion(
  operations: readonly MathOperation[],
  difficulty: DifficultyLevel,
  previous: Pick<Question, 'displayText'>,
  random: RandomSource = Math.random,
): Question {
  let question = generateQuestionForOperations(operations, difficulty, random)
  for (
    let retry = 0;
    retry < MAX_REPEAT_RETRIES && question.displayText === previous.displayText;
    retry++
  ) {
    question = generateQuestionForOperations(operations, difficulty, random)
  }
  return question
}

/** Generates a question using an operation picked at random from those enabled. */
export function generateQuestionForOperations(
  operations: readonly MathOperation[],
  difficulty: DifficultyLevel,
  random: RandomSource = Math.random,
): Question {
  if (operations.length === 0) {
    throw new QuestionGenerationError('Choose at least one operation.')
  }
  const operation = operations[randomInt(0, operations.length - 1, random)]
  return generateQuestion(operation, difficulty, random)
}
