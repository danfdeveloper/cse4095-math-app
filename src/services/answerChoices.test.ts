import { describe, expect, it } from 'vitest'
import { DIFFICULTY_LEVELS, MATH_OPERATIONS } from '../constants/practice'
import { ALMOST_ONE, seededRandom } from '../test/seededRandom'
import type { DifficultyLevel, MathOperation } from '../types/question'
import { calculateAnswer, type RandomSource } from '../utils/math'
import {
  addWithoutCarrying,
  additionMistakes,
  buildChoices,
  divisionMistakes,
  generateDistractors,
  MAX_NEARBY_ATTEMPTS,
  multiplicationMistakes,
  plausibleDistance,
  subtractionMistakes,
  subtractWithoutBorrowing,
  type AnswerContext,
} from './answerChoices'
import {
  generateAdditionQuestion,
  generateDivisionQuestion,
  generateMultiplicationQuestion,
  generateSubtractionQuestion,
} from './questionGenerator'

function context(
  operation: MathOperation,
  firstOperand: number,
  secondOperand: number,
): AnswerContext {
  return {
    operation,
    firstOperand,
    secondOperand,
    correctAnswer: calculateAnswer(operation, firstOperand, secondOperand),
  }
}

const generators = {
  addition: generateAdditionQuestion,
  subtraction: generateSubtractionQuestion,
  multiplication: generateMultiplicationQuestion,
  division: generateDivisionQuestion,
}

/** Realistic questions for every operation and level, to run property checks over. */
function sampleContexts(perCombination: number): AnswerContext[] {
  const random = seededRandom(31337)
  return MATH_OPERATIONS.flatMap((operation) =>
    DIFFICULTY_LEVELS.flatMap((level: DifficultyLevel) =>
      Array.from({ length: perCombination }, () =>
        generators[operation](level, random),
      ),
    ),
  )
}

/** Counts how often the random source is asked for a number. */
function counting(random: RandomSource) {
  const source = Object.assign(
    () => {
      source.calls++
      return random()
    },
    { calls: 0 },
  )
  return source
}

/** The cases where the answer is at or near zero. */
const NEAR_ZERO: AnswerContext[] = [
  context('addition', 0, 0),
  context('addition', 0, 1),
  context('addition', 1, 0),
  context('subtraction', 5, 5),
  context('subtraction', 1, 0),
  context('subtraction', 2, 1),
  context('multiplication', 0, 0),
  context('multiplication', 0, 5),
  context('multiplication', 1, 1),
  context('division', 0, 1),
  context('division', 0, 5),
  context('division', 1, 1),
  context('division', 2, 2),
]

describe('plausibleDistance', () => {
  it('is 20 for small answers and half the answer for large ones', () => {
    expect(plausibleDistance(0)).toBe(20)
    expect(plausibleDistance(15)).toBe(20)
    expect(plausibleDistance(40)).toBe(20)
    expect(plausibleDistance(56)).toBe(28)
    expect(plausibleDistance(9801)).toBe(4901)
  })

  it('is wide enough to keep the biggest "forgot to borrow" mistake', () => {
    // 50 - 19 = 31, but forgetting to borrow gives 49: 18 away.
    expect(subtractWithoutBorrowing(50, 19) - 31).toBe(18)
    expect(plausibleDistance(31)).toBeGreaterThanOrEqual(18)
  })
})

describe('column mistakes', () => {
  it('addWithoutCarrying drops each carry but writes the last column in full', () => {
    expect(addWithoutCarrying(58, 67)).toBe(115)
    expect(addWithoutCarrying(47, 38)).toBe(75)
    expect(addWithoutCarrying(458, 367)).toBe(715)
  })

  it('addWithoutCarrying equals the real sum when nothing carries', () => {
    expect(addWithoutCarrying(8, 7)).toBe(15)
    expect(addWithoutCarrying(23, 41)).toBe(64)
    expect(addWithoutCarrying(100, 5)).toBe(105)
    expect(addWithoutCarrying(0, 0)).toBe(0)
  })

  it('subtractWithoutBorrowing takes the smaller digit from the larger', () => {
    expect(subtractWithoutBorrowing(52, 38)).toBe(26)
    expect(subtractWithoutBorrowing(100, 99)).toBe(199)
    expect(subtractWithoutBorrowing(7, 7)).toBe(0)
  })
})

describe('operation-specific mistakes', () => {
  it('addition: slips, carry errors and subtracting instead', () => {
    const mistakes = additionMistakes(58, 67) // 125

    expect(mistakes).toEqual(
      expect.arrayContaining([124, 126, 123, 127, 135, 115, 9]),
    )
  })

  it('subtraction: slips, borrow errors and adding instead', () => {
    const mistakes = subtractionMistakes(52, 38) // 14

    expect(mistakes).toEqual(
      expect.arrayContaining([13, 15, 12, 16, 24, 4, 26, 90]),
    )
  })

  it('multiplication: the neighbouring table facts and adding instead', () => {
    const mistakes = multiplicationMistakes(7, 8) // 56

    // 6x8, 8x8, 7x7, 7x9, 7+8, then small slips
    expect(mistakes).toEqual(
      expect.arrayContaining([48, 64, 49, 63, 15, 55, 57, 46, 66]),
    )
  })

  it('division: neighbouring quotients and the other number in the fact family', () => {
    // 84 / 12 = 7. The divisor, 12, is the other number in the family 12 x 7 = 84,
    // and is nowhere near the quotient, so only the fact-family rule produces it.
    expect(divisionMistakes(84, 12)).toEqual(
      expect.arrayContaining([8, 6, 9, 5, 12]),
    )
  })
})

describe('generateDistractors', () => {
  it('always returns three unique, believable, whole, non-negative wrong answers', () => {
    const random = seededRandom(99)
    for (const question of sampleContexts(150)) {
      const distractors = generateDistractors(question, random)

      expect(distractors).toHaveLength(3)
      expect(new Set(distractors).size).toBe(3)
      for (const value of distractors) {
        expect(Number.isInteger(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).not.toBe(question.correctAnswer)
        expect(Math.abs(value - question.correctAnswer)).toBeLessThanOrEqual(
          plausibleDistance(question.correctAnswer),
        )
      }
    }
  })

  it('never produces a fractional choice for a division question', () => {
    const random = seededRandom(5)
    for (const level of DIFFICULTY_LEVELS) {
      for (let i = 0; i < 300; i++) {
        const question = generateDivisionQuestion(level, random)

        for (const value of generateDistractors(question, random)) {
          expect(Number.isInteger(value)).toBe(true)
        }
      }
    }
  })

  it('does not use the raw mistake list for a fraction (56 / 6 is not whole)', () => {
    expect(divisionMistakes(56, 7).some((v) => !Number.isInteger(v))).toBe(true)

    const random = seededRandom(8)
    for (let i = 0; i < 200; i++) {
      for (const value of generateDistractors(
        context('division', 56, 7),
        random,
      )) {
        expect(Number.isInteger(value)).toBe(true)
      }
    }
  })

  describe('when the answer is at or near zero', () => {
    it.each(NEAR_ZERO)(
      'finds three valid wrong answers for $operation $firstOperand, $secondOperand',
      (question) => {
        const random = seededRandom(1)
        for (let i = 0; i < 50; i++) {
          const distractors = generateDistractors(question, random)

          expect(distractors).toHaveLength(3)
          expect(new Set(distractors).size).toBe(3)
          for (const value of distractors) {
            expect(value).toBeGreaterThanOrEqual(0)
            expect(value).not.toBe(question.correctAnswer)
          }
        }
      },
    )

    it('uses 1, 2 and 10 for 0 + 0, the only believable non-negative options', () => {
      const distractors = generateDistractors(context('addition', 0, 0))

      expect(new Set(distractors)).toEqual(new Set([1, 2, 10]))
    })
  })

  describe('with a random source that gives no variety', () => {
    // A source stuck on one value makes every random "nearby" draw repeat, so
    // these exercise the retry limit and the ordered search that follows it.
    it.each([0, 0.5, ALMOST_ONE])(
      'still finds three wrong answers when it always returns %s',
      (value) => {
        for (const question of [...NEAR_ZERO, ...sampleContexts(5)]) {
          const distractors = generateDistractors(question, () => value)

          expect(distractors).toHaveLength(3)
          expect(new Set(distractors).size).toBe(3)
          for (const choice of distractors) {
            expect(choice).toBeGreaterThanOrEqual(0)
            expect(choice).not.toBe(question.correctAnswer)
          }
        }
      },
    )

    it('gives up on random draws after a fixed number of tries', () => {
      // 0 x 0 has only two believable mistakes, so a third must come from
      // random draws, which here can only repeat. The search must still stop.
      const random = counting(() => 0)

      const distractors = generateDistractors(
        context('multiplication', 0, 0),
        random,
      )

      expect(distractors).toHaveLength(3)
      expect(random.calls).toBeLessThanOrEqual(MAX_NEARBY_ATTEMPTS * 2 + 20)
    })
  })

  it('prefers the operation mistakes whenever there are enough of them', () => {
    const mistakes = new Set(multiplicationMistakes(7, 8))
    const random = seededRandom(77)
    for (let i = 0; i < 300; i++) {
      for (const value of generateDistractors(
        context('multiplication', 7, 8),
        random,
      )) {
        expect(mistakes.has(value)).toBe(true)
      }
    }
  })

  it('varies from one draw to the next', () => {
    const random = seededRandom(4)
    const sets = new Set<string>()
    for (let i = 0; i < 200; i++) {
      sets.add(
        generateDistractors(context('multiplication', 7, 8), random)
          .sort((a, b) => a - b)
          .join(','),
      )
    }

    expect(sets.size).toBeGreaterThan(10)
  })

  describe('uses the common mistakes of each operation', () => {
    const seen = (question: AnswerContext) => {
      const random = seededRandom(123)
      const values = new Set<number>()
      for (let i = 0; i < 300; i++) {
        for (const v of generateDistractors(question, random)) values.add(v)
      }
      return values
    }

    it('addition: forgetting to carry', () => {
      expect(seen(context('addition', 58, 67)).has(115)).toBe(true)
    })

    it('subtraction: forgetting to borrow', () => {
      expect(seen(context('subtraction', 52, 38)).has(26)).toBe(true)
      // The worst case, 18 away from the answer, is not filtered out.
      expect(seen(context('subtraction', 50, 19)).has(49)).toBe(true)
    })

    it('multiplication: the neighbouring table facts (7 x 8)', () => {
      const values = seen(context('multiplication', 7, 8))

      for (const neighbour of [48, 64, 49, 63]) {
        expect(values.has(neighbour)).toBe(true)
      }
    })

    it('division: the fact-family partner (84 / 12)', () => {
      const values = seen(context('division', 84, 12))

      expect(values.has(12)).toBe(true)
      for (const quotientSlip of [6, 8]) {
        expect(values.has(quotientSlip)).toBe(true)
      }
    })
  })
})

describe('buildChoices', () => {
  it('returns four unique choices containing the correct answer exactly once', () => {
    const random = seededRandom(2024)
    for (const question of sampleContexts(100)) {
      const choices = buildChoices(question, random)

      expect(choices).toHaveLength(4)
      expect(new Set(choices).size).toBe(4)
      expect(choices.filter((c) => c === question.correctAnswer)).toHaveLength(
        1,
      )
    }
  })

  it('does not put the correct answer in a predictable position', () => {
    const random = seededRandom(555)
    const question = context('multiplication', 7, 8)
    const positions = [0, 0, 0, 0]
    for (let i = 0; i < 2000; i++) {
      positions[
        buildChoices(question, random).indexOf(question.correctAnswer)
      ]++
    }

    // 2000 draws over 4 positions: about 500 each.
    for (const count of positions) {
      expect(count).toBeGreaterThan(400)
      expect(count).toBeLessThan(600)
    }
  })

  it('spreads the correct answer evenly across positions for every operation', () => {
    const random = seededRandom(556)
    for (const operation of MATH_OPERATIONS) {
      const positions = [0, 0, 0, 0]
      for (let i = 0; i < 1200; i++) {
        const question = generators[operation](3, random)
        positions[
          buildChoices(question, random).indexOf(question.correctAnswer)
        ]++
      }

      for (const count of positions) {
        expect(count, operation).toBeGreaterThan(220)
        expect(count, operation).toBeLessThan(380)
      }
    }
  })

  it('does not simply sort the choices', () => {
    const random = seededRandom(7)
    const question = context('addition', 47, 38)
    let ascending = 0
    for (let i = 0; i < 500; i++) {
      const choices = buildChoices(question, random)
      if (choices.every((c, index) => index === 0 || choices[index - 1] < c))
        ascending++
    }

    // Four items fall in ascending order 1 time in 24 by chance (about 21 of 500).
    expect(ascending).toBeLessThan(500 * 0.15)
  })

  it('gives the same choices for the same random source', () => {
    const question = context('subtraction', 52, 38)

    expect(buildChoices(question, seededRandom(42))).toEqual(
      buildChoices(question, seededRandom(42)),
    )
  })

  it('works for the edge cases near zero', () => {
    const random = seededRandom(3)
    for (const question of NEAR_ZERO) {
      const choices = buildChoices(question, random)

      expect(new Set(choices).size).toBe(4)
      expect(choices).toContain(question.correctAnswer)
      for (const choice of choices) expect(choice).toBeGreaterThanOrEqual(0)
    }
  })
})
