import { describe, expect, it } from 'vitest'
import type { MathOperation } from '../types/question'
import {
  spokenEquation,
  spokenExpression,
  spokenQuestion,
} from './questionText'

function parts(operation: MathOperation, a: number, b: number, answer: number) {
  return {
    operation,
    firstOperand: a,
    secondOperand: b,
    correctAnswer: answer,
  }
}

describe('spoken text for screen readers', () => {
  it.each([
    ['addition', 47, 38, '47 plus 38'],
    ['subtraction', 52, 38, '52 minus 38'],
    ['multiplication', 7, 8, '7 times 8'],
    ['division', 56, 7, '56 divided by 7'],
  ] as const)('says %s in words', (operation, a, b, expected) => {
    expect(spokenExpression(parts(operation, a, b, 0))).toBe(expected)
  })

  it('phrases the question', () => {
    expect(spokenQuestion(parts('multiplication', 7, 8, 56))).toBe(
      'What is 7 times 8?',
    )
  })

  it('phrases the solved equation', () => {
    expect(spokenEquation(parts('division', 56, 7, 8))).toBe(
      '56 divided by 7 equals 8',
    )
  })
})
