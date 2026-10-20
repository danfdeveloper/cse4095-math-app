import { describe, expect, it, vi } from 'vitest'
import { ALMOST_ONE, seededRandom } from '../test/seededRandom'

// At Levels 1 and 2 the spec's operand ranges already keep sums under the cap
// (10 + 10 = 20), so the cap never actually binds. Tighten Level 1's cap below
// what its operands allow, to prove the generator really enforces it.
vi.mock('../constants/difficultyRules', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../constants/difficultyRules')>()
  return {
    ...actual,
    ADDITION_RULES: {
      ...actual.ADDITION_RULES,
      1: { operands: { min: 0, max: 10 }, maxSum: 12 },
    },
  }
})

import { generateAdditionQuestion } from './questionGenerator'

describe('generateAdditionQuestion result limit', () => {
  it('never produces a result above the limit', () => {
    const random = seededRandom(11)
    const sums = new Set<number>()
    for (let i = 0; i < 2000; i++) {
      const q = generateAdditionQuestion(1, random)

      expect(q.correctAnswer).toBeLessThanOrEqual(12)
      expect(q.firstOperand).toBeLessThanOrEqual(10)
      expect(q.secondOperand).toBeLessThanOrEqual(10)
      sums.add(q.correctAnswer)
    }

    // The limit is reachable, not just never exceeded.
    expect(sums.has(12)).toBe(true)
  })

  it('shrinks the second number to fit when the first is large', () => {
    const q = generateAdditionQuestion(1, () => ALMOST_ONE)

    expect([q.firstOperand, q.secondOperand]).toEqual([10, 2])
    expect(q.correctAnswer).toBe(12)
  })
})
