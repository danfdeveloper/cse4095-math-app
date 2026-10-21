import { describe, expect, it } from 'vitest'
import {
  ADDITION_RULES,
  DIVISION_RULES,
  MULTIPLICATION_RULES,
  quotientRangeFor,
  SUBTRACTION_RULES,
} from '../constants/difficultyRules'
import { DIFFICULTY_LEVELS, MATH_OPERATIONS } from '../constants/practice'
import { makeMistakePattern } from '../test/fixtures'
import { ALMOST_ONE, seededRandom } from '../test/seededRandom'
import type { MistakePattern } from '../types/mistake'
import type { DifficultyLevel, MathOperation } from '../types/question'
import { calculateAnswer } from '../utils/math'
import {
  getQuestionProblems,
  isWithinDifficultyRules,
} from '../utils/validation'
import { createMistakePattern } from './mistakePatterns'
import { generateQuestion, QuestionGenerationError } from './questionGenerator'
import {
  factFamilyCandidates,
  findSimilarQuestions,
  generateSimilarQuestion,
  nearbyCandidates,
  nearbyReach,
  reversedCandidates,
  SIMILARITY_STRATEGIES,
  type QuestionSpec,
} from './similarQuestions'

/** A pattern for a question that the student missed, with the right answer worked out. */
function missed(
  operation: MathOperation,
  firstOperand: number,
  secondOperand: number,
  difficulty: DifficultyLevel,
): MistakePattern {
  return makeMistakePattern({
    operation,
    firstOperand,
    secondOperand,
    correctAnswer: calculateAnswer(operation, firstOperand, secondOperand),
    difficulty,
  })
}

const show = (specs: QuestionSpec[]) =>
  specs.map((s) => `${s.operation}:${s.firstOperand}:${s.secondOperand}`).sort()
const has = (
  specs: QuestionSpec[],
  operation: MathOperation,
  a: number,
  b: number,
) => show(specs).includes(`${operation}:${a}:${b}`)

/**
 * What is wrong with a list of candidates, as plain text. Every candidate must
 * belong to the level, none may be the original, and none may appear twice.
 * Checking in plain code and asserting once keeps the big sweeps below quick.
 */
function candidateProblems(
  pattern: MistakePattern,
  specs: QuestionSpec[],
  note = '',
): string[] {
  const where = `${pattern.operation} ${pattern.firstOperand}, ${pattern.secondOperand} at Level ${pattern.difficulty} ${note}`
  const problems: string[] = []
  const seen = new Set<string>()
  for (const s of specs) {
    const key = `${s.operation}:${s.firstOperand}:${s.secondOperand}`
    if (seen.has(key)) problems.push(`${where}: ${key} appears twice`)
    seen.add(key)
    if (
      s.operation === pattern.operation &&
      s.firstOperand === pattern.firstOperand &&
      s.secondOperand === pattern.secondOperand
    )
      problems.push(`${where}: includes the original`)
    if (
      !isWithinDifficultyRules(
        s.operation,
        s.firstOperand,
        s.secondOperand,
        pattern.difficulty,
      )
    )
      problems.push(`${where}: ${key} is outside the level`)
  }
  return problems
}

function expectSensible(
  pattern: MistakePattern,
  specs: QuestionSpec[],
  note = '',
) {
  expect(candidateProblems(pattern, specs, note)).toEqual([])
}

describe('nearbyReach', () => {
  it.each([
    [0, 2],
    [7, 2],
    [20, 2],
    [21, 10],
    [100, 10],
    [1000, 10],
  ])('lets %i move by up to %i', (value, reach) => {
    expect(nearbyReach(value)).toBe(reach)
  })
})

describe('nearby-number questions (Task 54)', () => {
  it('include the specification’s examples for 8 × 7', () => {
    const nearby = nearbyCandidates(missed('multiplication', 8, 7, 2))

    expect(has(nearby, 'multiplication', 8, 6)).toBe(true)
    expect(has(nearby, 'multiplication', 9, 7)).toBe(true)
  })

  it('change exactly one number, by a little, and keep the operation', () => {
    const pattern = missed('multiplication', 8, 7, 2)

    for (const s of nearbyCandidates(pattern)) {
      expect(s.operation).toBe('multiplication')
      const firstMoved = Math.abs(s.firstOperand - 8)
      const secondMoved = Math.abs(s.secondOperand - 7)
      expect(firstMoved === 0 || secondMoved === 0).toBe(true)
      expect(Math.max(firstMoved, secondMoved)).toBeGreaterThan(0)
      expect(Math.max(firstMoved, secondMoved)).toBeLessThanOrEqual(2)
    }
  })

  it('lists the numbers a little way off, nearest first', () => {
    // 5 + 3 at Level 1: 5 moves to 3, 4, 6, 7 and 3 moves to 1, 2, 4, 5.
    expect(show(nearbyCandidates(missed('addition', 5, 3, 1)))).toEqual(
      show([
        { operation: 'addition', firstOperand: 4, secondOperand: 3 },
        { operation: 'addition', firstOperand: 6, secondOperand: 3 },
        { operation: 'addition', firstOperand: 3, secondOperand: 3 },
        { operation: 'addition', firstOperand: 7, secondOperand: 3 },
        { operation: 'addition', firstOperand: 5, secondOperand: 2 },
        { operation: 'addition', firstOperand: 5, secondOperand: 4 },
        { operation: 'addition', firstOperand: 5, secondOperand: 1 },
        { operation: 'addition', firstOperand: 5, secondOperand: 5 },
      ]),
    )
  })

  it('lets bigger numbers move further, up to 10', () => {
    const nearby = nearbyCandidates(missed('addition', 47, 38, 3))

    expect(has(nearby, 'addition', 57, 38)).toBe(true) // +10
    expect(has(nearby, 'addition', 37, 38)).toBe(true) // -10
    expect(has(nearby, 'addition', 58, 38)).toBe(false) // +11
    expect(has(nearby, 'addition', 47, 48)).toBe(true)
    expect(has(nearby, 'addition', 47, 49)).toBe(false) // 38 + 11
    expect(has(nearby, 'addition', 47, 29)).toBe(true)
  })

  it('keep to the level’s numbers', () => {
    // Level 1 stops at 10, with sums up to 20.
    const nearby = nearbyCandidates(missed('addition', 10, 10, 1))

    expect(has(nearby, 'addition', 9, 10)).toBe(true)
    expect(has(nearby, 'addition', 11, 10)).toBe(false)
    expect(has(nearby, 'addition', 10, 11)).toBe(false)
    expectSensible(missed('addition', 10, 10, 1), nearby)
  })

  it('keep to the level’s sum limit', () => {
    // Level 2 sums stop at 100, so 50 + 50 cannot go up.
    const nearby = nearbyCandidates(missed('addition', 50, 50, 2))

    expect(nearby.every((s) => s.firstOperand + s.secondOperand <= 100)).toBe(
      true,
    )
    expect(has(nearby, 'addition', 49, 50)).toBe(true)
    expect(has(nearby, 'addition', 51, 50)).toBe(false)
  })

  it('never go below zero', () => {
    for (const s of nearbyCandidates(missed('addition', 1, 0, 1))) {
      expect(s.firstOperand).toBeGreaterThanOrEqual(0)
      expect(s.secondOperand).toBeGreaterThanOrEqual(0)
    }
  })

  it('never make a subtraction with an answer below zero', () => {
    for (const pattern of [
      missed('subtraction', 5, 5, 1),
      missed('subtraction', 6, 4, 1),
      missed('subtraction', 30, 28, 2),
      missed('subtraction', 100, 98, 3),
      missed('subtraction', 500, 497, 4),
    ]) {
      const nearby = nearbyCandidates(pattern)
      expect(nearby.length).toBeGreaterThan(0)
      for (const s of nearby) {
        expect(s.firstOperand).toBeGreaterThanOrEqual(s.secondOperand)
      }
    }
  })

  it('leave out a subtraction whose first number has dropped below the second', () => {
    const nearby = nearbyCandidates(missed('subtraction', 6, 5, 1))

    expect(has(nearby, 'subtraction', 4, 5)).toBe(false)
    expect(has(nearby, 'subtraction', 5, 5)).toBe(true)
    expect(has(nearby, 'subtraction', 6, 6)).toBe(true)
  })

  describe('for division', () => {
    it('change the divisor or the answer and work the dividend out again', () => {
      const nearby = nearbyCandidates(missed('division', 56, 7, 2))

      // Divisor 7 becomes 5, 6, 8 or 9, and the answer 8 stays: 5 × 8 = 40 and so on.
      expect(has(nearby, 'division', 48, 6)).toBe(true)
      expect(has(nearby, 'division', 64, 8)).toBe(true)
      expect(has(nearby, 'division', 40, 5)).toBe(true)
      expect(has(nearby, 'division', 72, 9)).toBe(true)
      // Answer 8 becomes 6, 7, 9 or 10, and the divisor 7 stays.
      expect(has(nearby, 'division', 42, 7)).toBe(true)
      expect(has(nearby, 'division', 49, 7)).toBe(true)
      expect(has(nearby, 'division', 63, 7)).toBe(true)
      expect(has(nearby, 'division', 70, 7)).toBe(true)
    })

    it('are always exact, with a divisor above zero', () => {
      for (const pattern of [
        missed('division', 56, 7, 2),
        missed('division', 3, 1, 1),
        missed('division', 0, 3, 1),
        missed('division', 144, 12, 3),
        missed('division', 612, 12, 4),
        missed('division', 990, 99, 4),
      ]) {
        const nearby = nearbyCandidates(pattern)
        expect(nearby.length).toBeGreaterThan(0)
        for (const s of nearby) {
          expect(s.secondOperand).toBeGreaterThan(0)
          expect(s.firstOperand % s.secondOperand).toBe(0)
        }
      }
    })

    it('never divide by zero', () => {
      // Divisor 1 would move to 0.
      const nearby = nearbyCandidates(missed('division', 3, 1, 1))

      expect(nearby.some((s) => s.secondOperand === 0)).toBe(false)
    })

    it('keep to the level’s dividends at Level 4', () => {
      const nearby = nearbyCandidates(missed('division', 612, 12, 4))

      for (const s of nearby) {
        expect(s.firstOperand).toBeGreaterThanOrEqual(145)
        expect(s.firstOperand).toBeLessThanOrEqual(1000)
      }
      expect(has(nearby, 'division', 561, 11)).toBe(true) // 11 × 51
      expect(has(nearby, 'division', 663, 13)).toBe(true) // 13 × 51
    })

    it('keep to the level’s answers at Level 1', () => {
      // 20 ÷ 5 = 4 at Level 1: answers stop at 5, divisors at 5.
      const nearby = nearbyCandidates(missed('division', 20, 5, 1))

      for (const s of nearby) {
        expect(s.secondOperand).toBeLessThanOrEqual(5)
        expect(s.firstOperand / s.secondOperand).toBeLessThanOrEqual(5)
      }
    })

    it('are none for a division that is not whole, or has no divisor', () => {
      expect(nearbyCandidates(missed('division', 7, 2, 2))).toEqual([])
      expect(
        nearbyCandidates({
          operation: 'division',
          firstOperand: 8,
          secondOperand: 0,
          difficulty: 2,
        }),
      ).toEqual([])
    })
  })

  it('never include the original question, or repeat one', () => {
    for (const pattern of [
      missed('addition', 7, 8, 1),
      missed('subtraction', 9, 3, 2),
      missed('multiplication', 6, 6, 2),
      missed('division', 36, 6, 2),
    ]) {
      expectSensible(pattern, nearbyCandidates(pattern))
    }
  })
})

describe('reversed-operand questions (Task 55)', () => {
  it('reverse an addition', () => {
    expect(reversedCandidates(missed('addition', 3, 9, 1))).toEqual([
      { operation: 'addition', firstOperand: 9, secondOperand: 3 },
    ])
  })

  it('reverse a multiplication, as the specification’s example does', () => {
    expect(reversedCandidates(missed('multiplication', 8, 7, 2))).toEqual([
      { operation: 'multiplication', firstOperand: 7, secondOperand: 8 },
    ])
  })

  it.each([
    ['addition', 7, 7],
    ['multiplication', 6, 6],
  ] as const)(
    'give nothing when the numbers of a %s are already equal',
    (op, a, b) => {
      expect(reversedCandidates(missed(op, a, b, 2))).toEqual([])
    },
  )

  it('do not treat a reversed subtraction as the same question', () => {
    expect(reversedCandidates(missed('subtraction', 9, 3, 2))).toEqual([])
    expect(reversedCandidates(missed('subtraction', 3, 3, 2))).toEqual([])
  })

  it('do not treat a reversed division as the same question', () => {
    expect(reversedCandidates(missed('division', 56, 7, 2))).toEqual([])
    expect(reversedCandidates(missed('division', 7, 7, 2))).toEqual([])
  })

  it('never offer a reversed subtraction or division, even for numbers that would make a valid one', () => {
    // These are not real patterns: 3 - 5 goes below zero and 2 / 4 is not whole.
    // Reversed, they would be 5 - 3 and 4 / 2, which the level allows. They must
    // still not be offered, as subtraction and division do not work both ways.
    expect(
      reversedCandidates({
        operation: 'subtraction',
        firstOperand: 3,
        secondOperand: 5,
        difficulty: 2,
      }),
    ).toEqual([])
    expect(
      reversedCandidates({
        operation: 'division',
        firstOperand: 2,
        secondOperand: 4,
        difficulty: 2,
      }),
    ).toEqual([])
  })

  it('work at every level, including one factor of two digits', () => {
    expect(reversedCandidates(missed('multiplication', 7, 48, 3))).toEqual([
      { operation: 'multiplication', firstOperand: 48, secondOperand: 7 },
    ])
    expect(reversedCandidates(missed('addition', 400, 25, 4))).toEqual([
      { operation: 'addition', firstOperand: 25, secondOperand: 400 },
    ])
  })

  it('leave out a reversal that does not fit the level', () => {
    // Not a question that Level 1 would ask, so the reversed one is not either.
    expect(
      reversedCandidates({
        operation: 'addition',
        firstOperand: 60,
        secondOperand: 2,
        difficulty: 1,
      }),
    ).toEqual([])
  })
})

describe('fact-family questions (Task 56)', () => {
  it('give the divisions for a multiplication, as the specification’s example does', () => {
    expect(
      show(factFamilyCandidates(missed('multiplication', 8, 7, 2))),
    ).toEqual(
      show([
        { operation: 'division', firstOperand: 56, secondOperand: 8 },
        { operation: 'division', firstOperand: 56, secondOperand: 7 },
      ]),
    )
  })

  it('give the multiplications and the other division for a division', () => {
    expect(show(factFamilyCandidates(missed('division', 56, 7, 2)))).toEqual(
      show([
        { operation: 'multiplication', firstOperand: 7, secondOperand: 8 },
        { operation: 'multiplication', firstOperand: 8, secondOperand: 7 },
        { operation: 'division', firstOperand: 56, secondOperand: 8 },
      ]),
    )
  })

  it('give the subtractions for an addition', () => {
    expect(show(factFamilyCandidates(missed('addition', 7, 8, 2)))).toEqual(
      show([
        { operation: 'subtraction', firstOperand: 15, secondOperand: 7 },
        { operation: 'subtraction', firstOperand: 15, secondOperand: 8 },
      ]),
    )
  })

  it('give the additions and the other subtraction for a subtraction', () => {
    expect(show(factFamilyCandidates(missed('subtraction', 15, 7, 2)))).toEqual(
      show([
        { operation: 'addition', firstOperand: 7, secondOperand: 8 },
        { operation: 'addition', firstOperand: 8, secondOperand: 7 },
        { operation: 'subtraction', firstOperand: 15, secondOperand: 8 },
      ]),
    )
  })

  it('answer the question each one asks', () => {
    // The answers are the numbers of the original fact.
    const family = factFamilyCandidates(missed('multiplication', 8, 7, 2))

    expect(
      family.map((s) =>
        calculateAnswer(s.operation, s.firstOperand, s.secondOperand),
      ),
    ).toEqual([7, 8])
  })

  it('use only the same three numbers as the original', () => {
    for (const pattern of [
      missed('addition', 7, 8, 2),
      missed('subtraction', 15, 7, 2),
      missed('multiplication', 8, 7, 2),
      missed('division', 56, 7, 2),
      missed('multiplication', 45, 7, 4),
      missed('addition', 120, 250, 4),
    ]) {
      const original = [
        pattern.firstOperand,
        pattern.secondOperand,
        pattern.correctAnswer,
      ].sort((a, b) => a - b)
      const family = factFamilyCandidates(pattern)
      expect(family.length).toBeGreaterThan(0)
      for (const s of family) {
        const numbers = [
          s.firstOperand,
          s.secondOperand,
          calculateAnswer(s.operation, s.firstOperand, s.secondOperand),
        ].sort((a, b) => a - b)
        expect(numbers).toEqual(original)
      }
    }
  })

  describe('match the level', () => {
    it('leave out a subtraction that uses numbers above Level 1’s', () => {
      // 7 + 8 = 15 is a Level 1 sum, but 15 - 7 is not a Level 1 subtraction.
      expect(factFamilyCandidates(missed('addition', 7, 8, 1))).toEqual([])
    })

    it('keep a subtraction that does fit Level 1', () => {
      expect(show(factFamilyCandidates(missed('addition', 3, 4, 1)))).toEqual(
        show([
          { operation: 'subtraction', firstOperand: 7, secondOperand: 3 },
          { operation: 'subtraction', firstOperand: 7, secondOperand: 4 },
        ]),
      )
    })

    it('leave out a division with a dividend above Level 3’s 144', () => {
      expect(factFamilyCandidates(missed('multiplication', 7, 48, 3))).toEqual(
        [],
      )
    })

    it('leave out a multiplication the level does not ask', () => {
      // 12 × 12 is a Level 3 division fact, but two two-digit factors are not Level 3 multiplication.
      expect(factFamilyCandidates(missed('division', 144, 12, 3))).toEqual([])
    })

    it('make a Level 4 division from a multiplication', () => {
      expect(
        show(factFamilyCandidates(missed('multiplication', 45, 7, 4))),
      ).toEqual(
        show([
          { operation: 'division', firstOperand: 315, secondOperand: 45 },
          { operation: 'division', firstOperand: 315, secondOperand: 7 },
        ]),
      )
    })

    it('leave out a Level 4 division whose dividend would be too big', () => {
      expect(factFamilyCandidates(missed('multiplication', 99, 99, 4))).toEqual(
        [],
      )
    })
  })

  describe('with zero', () => {
    it('never divide by zero', () => {
      // 0 × 5: 0 ÷ 5 is a fact, 0 ÷ 0 is not.
      expect(factFamilyCandidates(missed('multiplication', 0, 5, 1))).toEqual([
        { operation: 'division', firstOperand: 0, secondOperand: 5 },
      ])
    })

    it('give the multiplications for 0 ÷ 5, but not 0 ÷ 0', () => {
      expect(show(factFamilyCandidates(missed('division', 0, 5, 1)))).toEqual(
        show([
          { operation: 'multiplication', firstOperand: 5, secondOperand: 0 },
          { operation: 'multiplication', firstOperand: 0, secondOperand: 5 },
        ]),
      )
    })

    it('handle taking a number from itself', () => {
      // 5 - 5 = 0 gives 5 + 0 and 0 + 5 and 5 - 0.
      expect(
        show(factFamilyCandidates(missed('subtraction', 5, 5, 1))),
      ).toEqual(
        show([
          { operation: 'addition', firstOperand: 5, secondOperand: 0 },
          { operation: 'addition', firstOperand: 0, secondOperand: 5 },
          { operation: 'subtraction', firstOperand: 5, secondOperand: 0 },
        ]),
      )
    })
  })

  describe('with repeated numbers', () => {
    it('name each fact once', () => {
      expect(factFamilyCandidates(missed('addition', 5, 5, 1))).toEqual([
        { operation: 'subtraction', firstOperand: 10, secondOperand: 5 },
      ])
      expect(factFamilyCandidates(missed('multiplication', 4, 4, 2))).toEqual([
        { operation: 'division', firstOperand: 16, secondOperand: 4 },
      ])
    })

    it('leave out the sibling that is the question itself', () => {
      // 10 - 5 = 5: its sibling subtraction is 10 - 5 again.
      expect(
        show(factFamilyCandidates(missed('subtraction', 10, 5, 2))),
      ).toEqual(
        show([{ operation: 'addition', firstOperand: 5, secondOperand: 5 }]),
      )
      expect(show(factFamilyCandidates(missed('division', 36, 6, 2)))).toEqual(
        show([
          { operation: 'multiplication', firstOperand: 6, secondOperand: 6 },
        ]),
      )
    })
  })

  it('are none for a division that is not whole, or for something that is not an operation', () => {
    expect(factFamilyCandidates(missed('division', 7, 2, 2))).toEqual([])
    expect(
      factFamilyCandidates({
        operation: 'division',
        firstOperand: 5,
        secondOperand: 0,
        difficulty: 2,
      }),
    ).toEqual([])
    expect(
      factFamilyCandidates({
        operation: 'power' as never,
        firstOperand: 2,
        secondOperand: 3,
        difficulty: 2,
      }),
    ).toEqual([])
  })

  it('never include the original question, or repeat one', () => {
    for (const pattern of [
      missed('addition', 7, 8, 2),
      missed('subtraction', 10, 5, 2),
      missed('multiplication', 6, 6, 2),
      missed('division', 36, 6, 2),
    ]) {
      expectSensible(pattern, factFamilyCandidates(pattern))
    }
  })
})

describe('findSimilarQuestions', () => {
  it('gathers the three kinds', () => {
    const found = findSimilarQuestions(missed('multiplication', 8, 7, 2))

    expect(Object.keys(found).sort()).toEqual([...SIMILARITY_STRATEGIES].sort())
    expect(found.nearby).toEqual(
      nearbyCandidates(missed('multiplication', 8, 7, 2)),
    )
    expect(found.reversed).toHaveLength(1)
    expect(found['fact-family']).toHaveLength(2)
  })
})

/*
 * Every pattern that belongs to its level has something similar to ask. This is
 * why asking a regular question instead is only for patterns that do not belong.
 */
describe('a pattern that belongs to its level always has a similar question', () => {
  function everyQuestion(
    operation: MathOperation,
    level: DifficultyLevel,
  ): MistakePattern[] {
    const patterns: MistakePattern[] = []
    if (operation === 'addition') {
      const { operands, maxSum } = ADDITION_RULES[level]
      for (let a = operands.min; a <= operands.max; a++)
        for (let b = operands.min; b <= operands.max; b++)
          if (maxSum === undefined || a + b <= maxSum)
            patterns.push(missed('addition', a, b, level))
    } else if (operation === 'subtraction') {
      const { operands } = SUBTRACTION_RULES[level]
      for (let a = operands.min; a <= operands.max; a++)
        for (let b = operands.min; b <= a; b++)
          patterns.push(missed('subtraction', a, b, level))
    } else if (operation === 'multiplication') {
      for (const shape of MULTIPLICATION_RULES[level])
        for (let a = shape.first.min; a <= shape.first.max; a++)
          for (let b = shape.second.min; b <= shape.second.max; b++)
            patterns.push(missed('multiplication', a, b, level))
    } else {
      const rules = DIVISION_RULES[level]
      for (const range of rules.divisors)
        for (let divisor = range.min; divisor <= range.max; divisor++) {
          const quotients = quotientRangeFor(rules, divisor)
          if (quotients)
            for (let q = quotients.min; q <= quotients.max; q++)
              patterns.push(missed('division', divisor * q, divisor, level))
        }
    }
    return patterns
  }

  it.each(
    [1, 2].flatMap((level) =>
      MATH_OPERATIONS.map((operation) => [operation, level] as const),
    ),
  )('every %s question at Level %i (all of them)', (operation, level) => {
    const patterns = everyQuestion(operation, level as DifficultyLevel)
    expect(patterns.length).toBeGreaterThanOrEqual(30)
    const problems: string[] = []
    for (const pattern of patterns) {
      const found = findSimilarQuestions(pattern)
      const total = SIMILARITY_STRATEGIES.reduce(
        (n, strategy) => n + found[strategy].length,
        0,
      )
      if (total === 0)
        problems.push(
          `${operation} ${pattern.firstOperand}, ${pattern.secondOperand} has nothing similar`,
        )
      for (const strategy of SIMILARITY_STRATEGIES)
        problems.push(...candidateProblems(pattern, found[strategy], strategy))
    }
    expect(problems.slice(0, 5)).toEqual([])
  })

  it.each(
    [3, 4].flatMap((level) =>
      MATH_OPERATIONS.map((operation) => [operation, level] as const),
    ),
  )('%s questions at Level %i (a large sample of them)', (operation, level) => {
    const random = seededRandom(40 + level)
    const problems: string[] = []
    for (let i = 0; i < 1500; i++) {
      const question = generateQuestion(
        operation,
        level as DifficultyLevel,
        random,
      )
      const pattern = createMistakePattern({
        id: 'a',
        questionId: question.id,
        operation: question.operation,
        firstOperand: question.firstOperand,
        secondOperand: question.secondOperand,
        correctAnswer: question.correctAnswer,
        selectedAnswer: -1,
        selfReportedCorrect: false,
        difficulty: question.difficulty,
        source: 'regular',
        attemptedAt: '2026-03-04T10:00:00.000Z',
        sessionId: 's',
      })
      const found = findSimilarQuestions(pattern)

      if (found.nearby.length === 0)
        problems.push(`${question.displayText} has no nearby question`)
      for (const strategy of SIMILARITY_STRATEGIES)
        problems.push(...candidateProblems(pattern, found[strategy], strategy))
    }
    expect(problems.slice(0, 5)).toEqual([])
  })
})

describe('generateSimilarQuestion (Task 57)', () => {
  const eightTimesSeven = missed('multiplication', 8, 7, 2)

  it('gives a related question at the pattern’s level', () => {
    const question = generateSimilarQuestion(eightTimesSeven, seededRandom(1))

    expect(question.difficulty).toBe(2)
    expect(getQuestionProblems(question)).toEqual([])
  })

  it('labels it as mistake review, and attaches the pattern’s ID', () => {
    const question = generateSimilarQuestion(eightTimesSeven, seededRandom(1))

    expect(question.source).toBe('mistake-review')
    expect(question.mistakePatternId).toBe(eightTimesSeven.id)
  })

  it('gives each question a new ID of its own', () => {
    const random = seededRandom(2)
    const ids = new Set(
      Array.from(
        { length: 20 },
        () => generateSimilarQuestion(eightTimesSeven, random).id,
      ),
    )

    expect(ids.size).toBe(20)
  })

  it('gives four unique answer choices that include the right answer', () => {
    const question = generateSimilarQuestion(eightTimesSeven, seededRandom(3))

    expect(new Set(question.choices).size).toBe(4)
    expect(question.choices).toContain(question.correctAnswer)
    expect(question.correctAnswer).toBe(
      calculateAnswer(
        question.operation,
        question.firstOperand,
        question.secondOperand,
      ),
    )
  })

  it('shows its display text with the right symbol', () => {
    const random = seededRandom(4)
    for (let i = 0; i < 60; i++) {
      const q = generateSimilarQuestion(eightTimesSeven, random)
      const symbol = { division: '÷', multiplication: '×' }[
        q.operation as 'division' | 'multiplication'
      ]
      expect(q.displayText).toBe(
        `${q.firstOperand} ${symbol} ${q.secondOperand}`,
      )
    }
  })

  it('gives every kind of question in the specification’s example, and nothing else', () => {
    const random = seededRandom(5)
    const seen = new Set<string>()
    for (let i = 0; i < 400; i++) {
      seen.add(generateSimilarQuestion(eightTimesSeven, random).displayText)
    }

    const found = findSimilarQuestions(eightTimesSeven)
    const allowed = SIMILARITY_STRATEGIES.flatMap((s) => found[s]).map(
      (s) =>
        `${s.firstOperand} ${s.operation === 'division' ? '÷' : '×'} ${s.secondOperand}`,
    )
    expect([...seen].every((text) => allowed.includes(text))).toBe(true)
    // The specification's examples: 7 × 8, 8 × 6, 9 × 7, 56 ÷ 7 and 56 ÷ 8.
    for (const text of ['7 × 8', '8 × 6', '9 × 7', '56 ÷ 7', '56 ÷ 8']) {
      expect(seen.has(text), text).toBe(true)
    }
  })

  it('never asks the pattern’s own question', () => {
    const random = seededRandom(6)
    for (let i = 0; i < 500; i++) {
      const q = generateSimilarQuestion(eightTimesSeven, random)
      expect(q.displayText).not.toBe('8 × 7')
    }
  })

  describe('choosing a kind of question', () => {
    it('picks each kind that has a question to offer, each equally likely', () => {
      const random = seededRandom(7)
      const counts = { nearby: 0, reversed: 0, 'fact-family': 0 }
      const found = findSimilarQuestions(eightTimesSeven)
      const kindOf = (text: string) =>
        SIMILARITY_STRATEGIES.find((strategy) =>
          found[strategy].some(
            (s) =>
              `${s.firstOperand} ${s.operation === 'division' ? '÷' : '×'} ${s.secondOperand}` ===
              text,
          ),
        )!
      for (let i = 0; i < 3000; i++) {
        counts[
          kindOf(generateSimilarQuestion(eightTimesSeven, random).displayText)
        ]++
      }

      // One third each, whatever the number of questions in each kind.
      for (const kind of SIMILARITY_STRATEGIES) {
        expect(counts[kind] / 3000, kind).toBeGreaterThan(0.29)
        expect(counts[kind] / 3000, kind).toBeLessThan(0.37)
      }
    })

    it('never picks a kind that has nothing to offer', () => {
      // 6 × 6 has no reversal; a subtraction never has one.
      for (const pattern of [
        missed('multiplication', 6, 6, 2),
        missed('subtraction', 9, 3, 2),
        missed('division', 56, 7, 2),
      ]) {
        const found = findSimilarQuestions(pattern)
        expect(found.reversed).toEqual([])
        const allowed = new Set(
          [...found.nearby, ...found['fact-family']].map(
            (s) => `${s.operation}:${s.firstOperand}:${s.secondOperand}`,
          ),
        )
        const random = seededRandom(8)
        for (let i = 0; i < 200; i++) {
          const q = generateSimilarQuestion(pattern, random)
          expect(
            allowed.has(`${q.operation}:${q.firstOperand}:${q.secondOperand}`),
          ).toBe(true)
        }
      }
    })

    it('gives the first question of the first kind when the random source is lowest', () => {
      const lowest = generateSimilarQuestion(eightTimesSeven, () => 0)
      const first = findSimilarQuestions(eightTimesSeven).nearby[0]

      expect(lowest).toMatchObject({
        operation: first.operation,
        firstOperand: first.firstOperand,
        secondOperand: first.secondOperand,
      })
    })

    it('gives the last question of the last kind when the random source is highest', () => {
      const highest = generateSimilarQuestion(eightTimesSeven, () => ALMOST_ONE)
      const family = findSimilarQuestions(eightTimesSeven)['fact-family']
      const last = family[family.length - 1]

      expect(highest).toMatchObject({
        operation: last.operation,
        firstOperand: last.firstOperand,
        secondOperand: last.secondOperand,
      })
    })

    it('skips over a kind with nothing to offer when counting', () => {
      // 6 × 6 has no reversal, so a random source in the upper half reaches fact-family, not reversed.
      const pattern = missed('multiplication', 6, 6, 2)
      const highest = generateSimilarQuestion(pattern, () => ALMOST_ONE)

      expect(highest.operation).toBe('division')
    })
  })

  describe('avoiding questions already asked', () => {
    it('keeps away from the questions it is told to avoid', () => {
      const found = findSimilarQuestions(eightTimesSeven)
      const everything = SIMILARITY_STRATEGIES.flatMap((s) => found[s])
      const [keep, ...avoid] = everything

      const random = seededRandom(9)
      for (let i = 0; i < 100; i++) {
        const q = generateSimilarQuestion(eightTimesSeven, random, { avoid })
        expect(q).toMatchObject({
          operation: keep.operation,
          firstOperand: keep.firstOperand,
          secondOperand: keep.secondOperand,
        })
      }
    })

    it('still asks something when every question has been avoided', () => {
      const found = findSimilarQuestions(eightTimesSeven)
      const everything = SIMILARITY_STRATEGIES.flatMap((s) => found[s])

      const random = seededRandom(10)
      const allowed = new Set(
        everything.map(
          (s) => `${s.operation}:${s.firstOperand}:${s.secondOperand}`,
        ),
      )
      for (let i = 0; i < 50; i++) {
        const q = generateSimilarQuestion(eightTimesSeven, random, {
          avoid: everything,
        })

        expect(getQuestionProblems(q)).toEqual([])
        expect(q.source).toBe('mistake-review')
        // Still a question that is similar, not just any question.
        expect(
          allowed.has(`${q.operation}:${q.firstOperand}:${q.secondOperand}`),
        ).toBe(true)
      }
    })

    it('does not mind being told to avoid something that is not a candidate', () => {
      const random = seededRandom(11)
      const q = generateSimilarQuestion(eightTimesSeven, random, {
        avoid: [{ operation: 'addition', firstOperand: 1, secondOperand: 1 }],
      })

      expect(getQuestionProblems(q)).toEqual([])
    })

    it('makes a question that was avoided much less likely, never impossible, when others are left', () => {
      const avoid = [
        {
          operation: 'multiplication' as const,
          firstOperand: 7,
          secondOperand: 8,
        },
      ]
      const random = seededRandom(12)
      for (let i = 0; i < 300; i++) {
        expect(
          generateSimilarQuestion(eightTimesSeven, random, { avoid })
            .displayText,
        ).not.toBe('7 × 8')
      }
    })
  })

  describe('for every operation at every level', () => {
    const samples: [MathOperation, DifficultyLevel][] = MATH_OPERATIONS.flatMap(
      (operation) =>
        DIFFICULTY_LEVELS.map(
          (level) => [operation, level] as [MathOperation, DifficultyLevel],
        ),
    )

    it.each(samples)('%s at Level %i', (operation, level) => {
      const random = seededRandom(100 + level)
      const problems: string[] = []
      for (let i = 0; i < 250; i++) {
        const original = generateQuestion(operation, level, random)
        const pattern = missed(
          original.operation,
          original.firstOperand,
          original.secondOperand,
          level,
        )

        const question = generateSimilarQuestion(pattern, random)

        const where = `${original.displayText} at Level ${level} gave ${question.displayText}`
        problems.push(
          ...getQuestionProblems(question).map((p) => `${where}: ${p}`),
        )
        if (question.source !== 'mistake-review')
          problems.push(`${where}: not marked as mistake review`)
        if (question.mistakePatternId !== pattern.id)
          problems.push(`${where}: wrong pattern id`)
        if (question.difficulty !== level)
          problems.push(`${where}: wrong level`)
        if (question.displayText === original.displayText)
          problems.push(`${where}: the same question`)
        // It really is related: the same operation with a number moved a little,
        // the same numbers reversed, or the same three numbers.
        if (!isRelated(pattern, question))
          problems.push(`${where}: not related to the original`)
      }
      expect(problems.slice(0, 5)).toEqual([])
    })
  })

  it('does the same thing for the same random source', () => {
    const a = generateSimilarQuestion(eightTimesSeven, seededRandom(13))
    const b = generateSimilarQuestion(eightTimesSeven, seededRandom(13))

    expect({ ...a, id: '' }).toEqual({ ...b, id: '' })
  })

  it('does not change the pattern', () => {
    const pattern = Object.freeze({ ...eightTimesSeven })

    expect(() =>
      generateSimilarQuestion(pattern, seededRandom(14), {
        avoid: Object.freeze([]),
      }),
    ).not.toThrow()
    expect(pattern).toEqual(eightTimesSeven)
  })

  describe('for a pattern that does not belong to its level', () => {
    it('asks a regular question for the operation and level, still marked for the pattern', () => {
      // Level 2 never asks for a number like 200.
      const stray = missed('addition', 200, 2, 2)

      const question = generateSimilarQuestion(stray, seededRandom(15))

      expect(question.operation).toBe('addition')
      expect(question.difficulty).toBe(2)
      expect(getQuestionProblems(question)).toEqual([])
      expect(question.source).toBe('mistake-review')
      expect(question.mistakePatternId).toBe(stray.id)
    })

    it('copes with a division that is not whole', () => {
      const stray = makeMistakePattern({
        operation: 'division',
        firstOperand: 7,
        secondOperand: 2,
        correctAnswer: 3.5,
        difficulty: 2,
        id: 'division:7:2:2',
      })

      const question = generateSimilarQuestion(stray, seededRandom(16))

      expect(getQuestionProblems(question)).toEqual([])
    })
  })

  describe('for a pattern with an operation or level that does not exist', () => {
    it('says so rather than making something up', () => {
      expect(() =>
        generateSimilarQuestion(
          makeMistakePattern({ operation: 'power' as never }),
        ),
      ).toThrow(QuestionGenerationError)
      expect(() =>
        generateSimilarQuestion(makeMistakePattern({ difficulty: 9 as never })),
      ).toThrow(QuestionGenerationError)
    })
  })
})

/**
 * Whether the question is related to the pattern in one of the three ways,
 * worked out here on its own terms, without the service's candidate lists.
 */
function isRelated(
  pattern: MistakePattern,
  q: { operation: MathOperation; firstOperand: number; secondOperand: number },
): boolean {
  const { operation: op, firstOperand: a, secondOperand: b } = pattern

  // The same three numbers: the fact family.
  const threeNumbers = (x: typeof pattern | typeof q) =>
    [
      x.firstOperand,
      x.secondOperand,
      calculateAnswer(x.operation, x.firstOperand, x.secondOperand),
    ]
      .sort((m, n) => m - n)
      .join(',')
  if (q.operation !== op && threeNumbers(q) === threeNumbers(pattern))
    return true
  if (q.operation === op && threeNumbers(q) === threeNumbers(pattern)) {
    // Same operation and numbers: the reversal of an addition or multiplication,
    // or the other division or subtraction of the same family.
    if (
      (op === 'addition' || op === 'multiplication') &&
      q.firstOperand === b &&
      q.secondOperand === a
    )
      return true
    if (op === 'subtraction' || op === 'division') return true
  }

  // The same operation with one number moved a little.
  if (q.operation !== op) return false
  const reach = (n: number) => (n <= 20 ? 2 : 10)
  if (op === 'division') {
    // Seen as the fact: divisor and answer.
    const divisor = b
    const answer = a / b
    const qDivisor = q.secondOperand
    const qAnswer = q.firstOperand / q.secondOperand
    return (
      (qAnswer === answer && Math.abs(qDivisor - divisor) <= reach(divisor)) ||
      (qDivisor === divisor && Math.abs(qAnswer - answer) <= reach(answer))
    )
  }
  return (
    (q.secondOperand === b && Math.abs(q.firstOperand - a) <= reach(a)) ||
    (q.firstOperand === a && Math.abs(q.secondOperand - b) <= reach(b))
  )
}
