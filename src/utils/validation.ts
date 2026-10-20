import {
  ADDITION_RULES,
  DIVISION_RULES,
  MIN_ANSWER_VALUE,
  MULTIPLICATION_RULES,
  quotientRangeFor,
  SUBTRACTION_RULES,
} from '../constants/difficultyRules'
import {
  CHOICES_PER_QUESTION,
  DIFFICULTY_LEVELS,
  MATH_OPERATIONS,
  OPERATION_INFO,
} from '../constants/practice'
import type {
  DifficultyLevel,
  MathOperation,
  Question,
} from '../types/question'
import type { PracticeConfig } from '../types/session'
import { calculateAnswer, isInRange } from './math'

export function isSupportedOperation(value: unknown): value is MathOperation {
  return MATH_OPERATIONS.includes(value as MathOperation)
}

export function isDifficultyLevel(value: unknown): value is DifficultyLevel {
  return DIFFICULTY_LEVELS.includes(value as DifficultyLevel)
}

/** Whether a value (such as router state, which is untyped) is a usable practice setup. */
export function isPracticeConfig(value: unknown): value is PracticeConfig {
  if (typeof value !== 'object' || value === null) return false

  const { operations, difficulty, sessionLength } = value as Record<
    string,
    unknown
  >
  return (
    Array.isArray(operations) &&
    operations.length > 0 &&
    operations.every(isSupportedOperation) &&
    isDifficultyLevel(difficulty) &&
    (sessionLength === 'continuous' ||
      (typeof sessionLength === 'number' &&
        Number.isInteger(sessionLength) &&
        sessionLength > 0))
  )
}

/** Whether these operands are allowed at the level, by the rules in specification section 7. */
export function isWithinDifficultyRules(
  operation: MathOperation,
  first: number,
  second: number,
  difficulty: DifficultyLevel,
): boolean {
  switch (operation) {
    case 'addition': {
      const { operands, maxSum } = ADDITION_RULES[difficulty]
      return (
        isInRange(first, operands) &&
        isInRange(second, operands) &&
        (maxSum === undefined || first + second <= maxSum)
      )
    }
    case 'subtraction': {
      const { operands } = SUBTRACTION_RULES[difficulty]
      return (
        isInRange(first, operands) &&
        isInRange(second, operands) &&
        first >= second
      )
    }
    case 'multiplication':
      return MULTIPLICATION_RULES[difficulty].some(
        ({ first: a, second: b }) =>
          (isInRange(first, a) && isInRange(second, b)) ||
          (isInRange(first, b) && isInRange(second, a)),
      )
    case 'division': {
      // first is the dividend, second is the divisor.
      const rules = DIVISION_RULES[difficulty]
      if (!rules.divisors.some((range) => isInRange(second, range)))
        return false
      const quotients = quotientRangeFor(rules, second)
      return (
        quotients !== null &&
        first % second === 0 &&
        isInRange(first / second, quotients)
      )
    }
  }
}

/**
 * Lists everything wrong with a question that is about to be shown (an empty
 * list means it is fine). Covers the rules in specification section 18, plus
 * the answer-type rules from section 8.2 (whole numbers, never negative).
 */
export function getQuestionProblems(question: Question): string[] {
  if (!isSupportedOperation(question.operation)) {
    return [`Unsupported operation: ${String(question.operation)}`]
  }
  if (!isDifficultyLevel(question.difficulty)) {
    return [`Unsupported difficulty level: ${String(question.difficulty)}`]
  }

  const { operation, difficulty, firstOperand, secondOperand } = question
  const problems: string[] = []

  if (!question.id) problems.push('The question has no id')
  if (!question.displayText) problems.push('The question has no display text')

  if (!Number.isInteger(firstOperand) || !Number.isInteger(secondOperand)) {
    problems.push('Operands must be whole numbers')
    return problems
  }
  if (operation === 'division' && secondOperand === 0) {
    problems.push('Division by zero')
    return problems
  }

  const expected = calculateAnswer(operation, firstOperand, secondOperand)
  if (operation === 'division' && !Number.isInteger(expected)) {
    problems.push('Division answers must be whole numbers')
  } else if (
    !Number.isFinite(question.correctAnswer) ||
    question.correctAnswer !== expected
  ) {
    problems.push(
      `Correct answer ${question.correctAnswer} should be ${expected}`,
    )
  }

  if (
    !isWithinDifficultyRules(operation, firstOperand, secondOperand, difficulty)
  ) {
    problems.push(
      `${firstOperand} ${OPERATION_INFO[operation].symbol} ${secondOperand} is outside the Level ${difficulty} rules`,
    )
  }

  problems.push(...getChoiceProblems(question))
  return problems
}

function getChoiceProblems({ choices, correctAnswer }: Question): string[] {
  if (!Array.isArray(choices) || choices.length !== CHOICES_PER_QUESTION) {
    return [`There must be exactly ${CHOICES_PER_QUESTION} answer choices`]
  }

  const problems: string[] = []
  if (new Set(choices).size !== choices.length) {
    problems.push('Answer choices must be unique')
  }
  if (choices.filter((choice) => choice === correctAnswer).length !== 1) {
    problems.push('Exactly one answer choice must equal the correct answer')
  }
  if (!choices.every((choice) => Number.isInteger(choice))) {
    problems.push('Answer choices must be whole numbers')
  }
  if (choices.some((choice) => choice < MIN_ANSWER_VALUE)) {
    problems.push('Answer choices cannot be negative')
  }
  return problems
}

export function isValidQuestion(question: Question): boolean {
  return getQuestionProblems(question).length === 0
}
