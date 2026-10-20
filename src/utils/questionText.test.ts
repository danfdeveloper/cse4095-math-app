import { describe, expect, it } from 'vitest'
import type { MathOperation } from '../types/question'
import {
  explainQuestion,
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

describe('explainQuestion', () => {
  it('explains addition', () => {
    expect(explainQuestion(parts('addition', 47, 38, 85))).toBe(
      'Add 47 and 38 together to get 85.',
    )
  })

  it('explains subtraction', () => {
    expect(explainQuestion(parts('subtraction', 52, 38, 14))).toBe(
      'Take 38 away from 52 and you are left with 14.',
    )
  })

  it('explains multiplication as groups', () => {
    expect(explainQuestion(parts('multiplication', 7, 8, 56))).toBe(
      '7 × 8 means 7 groups of 8, which makes 56.',
    )
  })

  it('says "group" for a single group', () => {
    expect(explainQuestion(parts('multiplication', 1, 9, 9))).toBe(
      '1 × 9 means 1 group of 9, which makes 9.',
    )
  })

  it('explains division with its times-table partner', () => {
    expect(explainQuestion(parts('division', 56, 7, 8))).toBe(
      '56 ÷ 7 asks how many 7s fit into 56. Since 7 × 8 = 56, the answer is 8.',
    )
  })

  it('handles zero', () => {
    expect(explainQuestion(parts('multiplication', 0, 5, 0))).toBe(
      '0 × 5 means 0 groups of 5, which makes 0.',
    )
    expect(explainQuestion(parts('division', 0, 5, 0))).toBe(
      '0 ÷ 5 asks how many 5s fit into 0. Since 5 × 0 = 0, the answer is 0.',
    )
  })

  it('rejects an unsupported operation', () => {
    expect(() => explainQuestion(parts('power' as never, 2, 3, 8))).toThrow(
      /unsupported operation/i,
    )
  })
})
