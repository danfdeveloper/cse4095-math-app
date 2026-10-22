import { describe, expect, it, vi } from 'vitest'
import { DIFFICULTY_LEVELS, MATH_OPERATIONS } from '../constants/practice'
import { ALMOST_ONE, seededRandom, sequenceRandom } from '../test/seededRandom'
import type {
  DifficultyLevel,
  MathOperation,
  Question,
} from '../types/question'
import { getQuestionProblems, isValidQuestion } from '../utils/validation'
import {
  generateAdditionQuestion,
  generateDivisionQuestion,
  generateMultiplicationQuestion,
  generateNextQuestion,
  generateQuestion,
  generateQuestionForOperations,
  generateSubtractionQuestion,
  MAX_REPEAT_RETRIES,
  fallbackQuestion,
  generateCheckedQuestion,
  MAX_GENERATION_ATTEMPTS,
  QuestionGenerationError,
} from './questionGenerator'

const SAMPLES = 400

/** Generates many questions with a reproducible random source. */
function sample(
  generate: (level: DifficultyLevel, random: () => number) => Question,
  level: DifficultyLevel,
): Question[] {
  const random = seededRandom(level * 7919)
  return Array.from({ length: SAMPLES }, () => generate(level, random))
}

/** Checks that apply to a question of any operation. */
function expectWellFormed(
  question: Question,
  operation: MathOperation,
  level: DifficultyLevel,
) {
  expect(question.operation).toBe(operation)
  expect(question.difficulty).toBe(level)
  expect(question.source).toBe('regular')
  expect(question.id).toBeTruthy()
  expect(Number.isInteger(question.correctAnswer)).toBe(true)
  expect(isValidQuestion(question)).toBe(true)

  // Exactly four unique, non-negative choices, with the right answer once.
  expect(question.choices).toHaveLength(4)
  expect(new Set(question.choices).size).toBe(4)
  expect(
    question.choices.filter((choice) => choice === question.correctAnswer),
  ).toHaveLength(1)
  for (const choice of question.choices) {
    expect(Number.isInteger(choice)).toBe(true)
    expect(choice).toBeGreaterThanOrEqual(0)
  }
}

describe('generateAdditionQuestion', () => {
  // [level, smallest operand, largest operand, largest allowed sum]
  const levels: [DifficultyLevel, number, number, number | undefined][] = [
    [1, 0, 10, 20],
    [2, 0, 50, 100],
    [3, 0, 100, undefined],
    [4, 10, 1000, undefined],
  ]

  describe.each(levels)('Level %i', (level, min, max, maxSum) => {
    it('returns valid addition questions within the level rules', () => {
      for (const q of sample(generateAdditionQuestion, level)) {
        expectWellFormed(q, 'addition', level)
        expect(q.firstOperand).toBeGreaterThanOrEqual(min)
        expect(q.firstOperand).toBeLessThanOrEqual(max)
        expect(q.secondOperand).toBeGreaterThanOrEqual(min)
        expect(q.secondOperand).toBeLessThanOrEqual(max)
        expect(q.correctAnswer).toBe(q.firstOperand + q.secondOperand)
        expect(q.displayText).toBe(`${q.firstOperand} + ${q.secondOperand}`)
        if (maxSum !== undefined)
          expect(q.correctAnswer).toBeLessThanOrEqual(maxSum)
      }
    })

    it('can use the smallest operands', () => {
      const q = generateAdditionQuestion(level, () => 0)

      expect([q.firstOperand, q.secondOperand]).toEqual([min, min])
    })

    it('can use the largest operands without passing the result limit', () => {
      const q = generateAdditionQuestion(level, () => ALMOST_ONE)

      expect([q.firstOperand, q.secondOperand]).toEqual([max, max])
      if (maxSum !== undefined)
        expect(q.correctAnswer).toBeLessThanOrEqual(maxSum)
    })
  })

  it('has a largest possible result of exactly 20 at Level 1 and 100 at Level 2', () => {
    expect(generateAdditionQuestion(1, () => ALMOST_ONE).correctAnswer).toBe(20)
    expect(generateAdditionQuestion(2, () => ALMOST_ONE).correctAnswer).toBe(
      100,
    )
  })
})

describe('generateSubtractionQuestion', () => {
  const levels: [DifficultyLevel, number, number][] = [
    [1, 0, 10],
    [2, 0, 50],
    [3, 0, 100],
    [4, 10, 1000],
  ]

  describe.each(levels)('Level %i', (level, min, max) => {
    it('returns valid subtraction questions that are never negative', () => {
      for (const q of sample(generateSubtractionQuestion, level)) {
        expectWellFormed(q, 'subtraction', level)
        expect(q.firstOperand).toBeGreaterThanOrEqual(q.secondOperand)
        expect(q.firstOperand).toBeGreaterThanOrEqual(min)
        expect(q.firstOperand).toBeLessThanOrEqual(max)
        expect(q.secondOperand).toBeGreaterThanOrEqual(min)
        expect(q.secondOperand).toBeLessThanOrEqual(max)
        expect(q.correctAnswer).toBe(q.firstOperand - q.secondOperand)
        expect(q.correctAnswer).toBeGreaterThanOrEqual(0)
        expect(q.displayText).toBe(`${q.firstOperand} − ${q.secondOperand}`)
      }
    })

    it('can produce an answer of zero', () => {
      const q = generateSubtractionQuestion(level, () => 0)

      expect(q.correctAnswer).toBe(0)
      expect(q.firstOperand).toBe(min)
    })

    it('can produce the biggest possible difference', () => {
      const q = generateSubtractionQuestion(
        level,
        sequenceRandom([ALMOST_ONE, 0]),
      )

      expect(q.firstOperand).toBe(max)
      expect(q.secondOperand).toBe(min)
      expect(q.correctAnswer).toBe(max - min)
    })

    it('puts the larger number first whichever order it was drawn in', () => {
      const q = generateSubtractionQuestion(
        level,
        sequenceRandom([0, ALMOST_ONE]),
      )

      expect(q.firstOperand).toBe(max)
      expect(q.secondOperand).toBe(min)
    })
  })
})

describe('generateMultiplicationQuestion', () => {
  // Written out by hand rather than read from the rule table, so a mistake in
  // the table is not repeated here.
  const fitsLevel: Record<DifficultyLevel, (a: number, b: number) => boolean> =
    {
      1: (a, b) => Math.max(a, b) <= 5,
      2: (a, b) => Math.max(a, b) <= 10,
      // one-digit by one-digit, or one-digit by two-digit
      3: (a, b) => Math.min(a, b) <= 9 && Math.max(a, b) <= 99,
      // two-digit by one-digit, or two-digit by two-digit
      4: (a, b) => Math.max(a, b) >= 10 && Math.max(a, b) <= 99,
    }

  describe.each(DIFFICULTY_LEVELS)('Level %i', (level) => {
    it('returns valid multiplication questions with factors in range', () => {
      for (const q of sample(generateMultiplicationQuestion, level)) {
        expectWellFormed(q, 'multiplication', level)
        expect(
          Math.min(q.firstOperand, q.secondOperand),
        ).toBeGreaterThanOrEqual(0)
        expect(fitsLevel[level](q.firstOperand, q.secondOperand)).toBe(true)
        expect(q.correctAnswer).toBe(q.firstOperand * q.secondOperand)
        expect(q.displayText).toBe(`${q.firstOperand} × ${q.secondOperand}`)
      }
    })
  })

  it('uses factors from 0 to 5 at Level 1, including both ends', () => {
    expect(generateMultiplicationQuestion(1, () => 0).correctAnswer).toBe(0)
    const biggest = generateMultiplicationQuestion(1, () => ALMOST_ONE)
    expect([biggest.firstOperand, biggest.secondOperand]).toEqual([5, 5])
  })

  it('uses factors from 0 to 10 at Level 2, including both ends', () => {
    const smallest = generateMultiplicationQuestion(2, () => 0)
    expect([smallest.firstOperand, smallest.secondOperand]).toEqual([0, 0])
    const biggest = generateMultiplicationQuestion(2, () => ALMOST_ONE)
    expect([biggest.firstOperand, biggest.secondOperand]).toEqual([10, 10])
  })

  it('reaches one-digit by two-digit questions at Level 3', () => {
    const q = generateMultiplicationQuestion(3, () => ALMOST_ONE)

    expect([q.firstOperand, q.secondOperand]).toEqual([9, 99])
    expect(q.correctAnswer).toBe(891)
  })

  it('reaches two-digit by two-digit questions at Level 4', () => {
    const q = generateMultiplicationQuestion(4, () => ALMOST_ONE)

    expect([q.firstOperand, q.secondOperand]).toEqual([99, 99])
    expect(q.correctAnswer).toBe(9801)
  })

  it('mixes both kinds of question within Levels 3 and 4', () => {
    for (const level of [3, 4] as const) {
      const questions = sample(generateMultiplicationQuestion, level)
      const bothOneDigitOrBothTwoDigit = questions.filter(
        (q) => q.firstOperand >= 10 === q.secondOperand >= 10,
      )

      expect(bothOneDigitOrBothTwoDigit.length).toBeGreaterThan(SAMPLES * 0.25)
      expect(bothOneDigitOrBothTwoDigit.length).toBeLessThan(SAMPLES * 0.75)
    }
  })

  it('shows the larger factor first about half the time', () => {
    const questions = sample(generateMultiplicationQuestion, 4).filter(
      (q) => q.firstOperand !== q.secondOperand,
    )
    const largerFirst = questions.filter(
      (q) => q.firstOperand > q.secondOperand,
    )

    expect(largerFirst.length).toBeGreaterThan(questions.length * 0.35)
    expect(largerFirst.length).toBeLessThan(questions.length * 0.65)
  })
})

describe('generateDivisionQuestion', () => {
  // Written out by hand rather than read from the rule table (see multiplication above).
  const fitsLevel: Record<
    DifficultyLevel,
    (dividend: number, divisor: number) => boolean
  > = {
    1: (dividend, divisor) =>
      divisor >= 1 && divisor <= 5 && dividend / divisor <= 5,
    2: (dividend, divisor) =>
      divisor >= 1 && divisor <= 10 && dividend / divisor <= 10,
    3: (dividend, divisor) => divisor >= 1 && divisor <= 12 && dividend <= 144,
    4: (dividend, divisor) =>
      divisor >= 2 && divisor <= 99 && dividend >= 145 && dividend <= 1000,
  }

  describe.each(DIFFICULTY_LEVELS)('Level %i', (level) => {
    it('returns valid division questions with whole-number answers', () => {
      for (const q of sample(generateDivisionQuestion, level)) {
        expectWellFormed(q, 'division', level)
        expect(q.firstOperand % q.secondOperand).toBe(0)
        expect(q.correctAnswer).toBe(q.firstOperand / q.secondOperand)
        expect(q.firstOperand).toBe(q.secondOperand * q.correctAnswer)
        expect(q.correctAnswer).toBeGreaterThanOrEqual(0)
        expect(fitsLevel[level](q.firstOperand, q.secondOperand)).toBe(true)
        expect(q.displayText).toBe(`${q.firstOperand} ÷ ${q.secondOperand}`)
      }
    })

    it('can never divide by zero', () => {
      // Try the lowest, highest and a spread of random values for every draw.
      const draws = [0, 0.25, 0.5, 0.75, ALMOST_ONE]
      for (const a of draws) {
        for (const b of draws) {
          for (const c of draws) {
            const q = generateDivisionQuestion(level, sequenceRandom([a, b, c]))

            expect(q.secondOperand).toBeGreaterThanOrEqual(1)
          }
        }
      }
      for (const q of sample(generateDivisionQuestion, level)) {
        expect(q.secondOperand).not.toBe(0)
      }
    })
  })

  it('reaches the smallest question at Level 1: 0 ÷ 1', () => {
    const q = generateDivisionQuestion(1, () => 0)

    expect([q.firstOperand, q.secondOperand, q.correctAnswer]).toEqual([
      0, 1, 0,
    ])
  })

  it('reaches the largest question at each of Levels 1-3', () => {
    const top = (level: DifficultyLevel) => {
      const q = generateDivisionQuestion(level, () => ALMOST_ONE)
      return [q.firstOperand, q.secondOperand, q.correctAnswer]
    }

    expect(top(1)).toEqual([25, 5, 5])
    expect(top(2)).toEqual([100, 10, 10])
    expect(top(3)).toEqual([144, 12, 12])
  })

  it('reaches both ends of Level 4', () => {
    const smallest = generateDivisionQuestion(4, () => 0)
    const largest = generateDivisionQuestion(4, () => ALMOST_ONE)

    expect([smallest.firstOperand, smallest.secondOperand]).toEqual([146, 2])
    expect([largest.firstOperand, largest.secondOperand]).toEqual([990, 99])
  })

  it('uses both one-digit and two-digit divisors at Level 4', () => {
    const questions = sample(generateDivisionQuestion, 4)
    const oneDigit = questions.filter((q) => q.secondOperand <= 9)

    expect(oneDigit.length).toBeGreaterThan(SAMPLES * 0.35)
    expect(oneDigit.length).toBeLessThan(SAMPLES * 0.65)
  })

  it('builds the question from a divisor and answer (dividend = divisor × answer)', () => {
    // Draws, in order: which group of divisors, the divisor (4 of 1-5), the answer (3 of 0-5).
    const q = generateDivisionQuestion(1, sequenceRandom([0, 0.6, 0.5]))

    expect(q.secondOperand).toBe(4)
    expect(q.correctAnswer).toBe(3)
    expect(q.firstOperand).toBe(12)
    expect(q.displayText).toBe('12 ÷ 4')
  })
})

describe('generateQuestion', () => {
  const combos = MATH_OPERATIONS.flatMap((operation) =>
    DIFFICULTY_LEVELS.map((level): [MathOperation, DifficultyLevel] => [
      operation,
      level,
    ]),
  )

  it.each(combos)(
    'generates a valid %s question at Level %i',
    (operation, level) => {
      const random = seededRandom(level)
      for (let i = 0; i < 100; i++) {
        expectWellFormed(
          generateQuestion(operation, level, random),
          operation,
          level,
        )
      }
    },
  )

  it('works with the real random source by default', () => {
    for (const operation of MATH_OPERATIONS) {
      expectWellFormed(generateQuestion(operation, 3), operation, 3)
    }
  })

  it('does not keep the correct answer in the same position', () => {
    const random = seededRandom(404)
    const positions = [0, 0, 0, 0]
    for (let i = 0; i < 2000; i++) {
      const q = generateQuestionForOperations(MATH_OPERATIONS, 2, random)
      positions[q.choices.indexOf(q.correctAnswer)]++
    }

    for (const count of positions) {
      expect(count).toBeGreaterThan(400)
      expect(count).toBeLessThan(600)
    }
  })

  it('gives every question its own id', () => {
    const ids = new Set(
      Array.from({ length: 1000 }, () => generateQuestion('addition', 1).id),
    )

    expect(ids.size).toBe(1000)
  })

  it('passes its random source on to the operation generator', () => {
    const q = generateQuestion('addition', 2, () => 0)

    expect([q.firstOperand, q.secondOperand]).toEqual([0, 0])
  })

  it('rejects an unsupported operation', () => {
    expect(() => generateQuestion('power' as never, 1)).toThrow(
      QuestionGenerationError,
    )
    expect(() => generateQuestion('toString' as never, 1)).toThrow(
      /unsupported operation/i,
    )
  })

  it.each([0, 5, 2.5, '2'])(
    'rejects the unsupported difficulty level %j',
    (level) => {
      expect(() => generateQuestion('addition', level as never)).toThrow(
        QuestionGenerationError,
      )
    },
  )

  it('gives a valid fallback question, instead of failing, when making one keeps throwing', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failing = () => {
      throw new Error('boom')
    }

    const question = generateQuestion('addition', 1, failing)

    expect(question).toEqual({
      ...fallbackQuestion('addition', 1),
      id: question.id,
    })
    expect(getQuestionProblems(question)).toEqual([])
    expect(errors).toHaveBeenCalledTimes(MAX_GENERATION_ATTEMPTS + 1)
    errors.mockRestore()
  })
})

describe('generateQuestionForOperations', () => {
  it('only uses the operations it is given', () => {
    const random = seededRandom(5)
    const seen = new Set<MathOperation>()
    for (let i = 0; i < 300; i++) {
      seen.add(
        generateQuestionForOperations(['addition', 'division'], 2, random)
          .operation,
      )
    }

    expect([...seen].sort()).toEqual(['addition', 'division'])
  })

  it('always uses the operation when only one is given', () => {
    const random = seededRandom(6)
    for (let i = 0; i < 100; i++) {
      expect(
        generateQuestionForOperations(['subtraction'], 1, random).operation,
      ).toBe('subtraction')
    }
  })

  it('picks among all four operations about equally', () => {
    const random = seededRandom(7)
    const counts: Record<string, number> = {}
    for (let i = 0; i < 2000; i++) {
      const { operation } = generateQuestionForOperations(
        MATH_OPERATIONS,
        3,
        random,
      )
      counts[operation] = (counts[operation] ?? 0) + 1
    }

    expect(Object.keys(counts).sort()).toEqual([...MATH_OPERATIONS].sort())
    for (const count of Object.values(counts)) {
      expect(count).toBeGreaterThan(2000 * 0.2)
      expect(count).toBeLessThan(2000 * 0.3)
    }
  })

  it('generates questions at the requested difficulty', () => {
    const random = seededRandom(8)
    for (let i = 0; i < 100; i++) {
      const question = generateQuestionForOperations(MATH_OPERATIONS, 4, random)
      expectWellFormed(question, question.operation, 4)
    }
  })

  it('refuses an empty list of operations', () => {
    expect(() => generateQuestionForOperations([], 1)).toThrow(
      QuestionGenerationError,
    )
  })
})

describe('generateNextQuestion', () => {
  it('never repeats the previous question', () => {
    const random = seededRandom(21)
    // Level 1 multiplication has only 36 possible questions, so repeats would be likely without care.
    let previous = generateQuestion('multiplication', 1, random)
    for (let i = 0; i < 1000; i++) {
      const next = generateNextQuestion(['multiplication'], 1, previous, random)

      expect(next.displayText).not.toBe(previous.displayText)
      previous = next
    }
  })

  it('uses only the operations and level it is given', () => {
    const random = seededRandom(22)
    const previous = generateQuestion('addition', 3, random)
    for (let i = 0; i < 200; i++) {
      const next = generateNextQuestion(
        ['subtraction', 'division'],
        4,
        previous,
        random,
      )

      expect(['subtraction', 'division']).toContain(next.operation)
      expect(next.difficulty).toBe(4)
      expect(isValidQuestion(next)).toBe(true)
    }
  })

  it('gives a complete, valid question with four choices', () => {
    const previous = generateQuestion('addition', 1)

    const next = generateNextQuestion(['addition'], 1, previous)

    expect(next.choices).toHaveLength(4)
    expect(isValidQuestion(next)).toBe(true)
  })

  it('gives up avoiding a repeat after a fixed number of tries', () => {
    // A source stuck on one value can only ever produce the same question.
    const stuck = () => 0
    const previous = generateQuestion('addition', 1, stuck)
    let calls = 0
    const counting = () => {
      calls++
      return 0
    }

    const next = generateNextQuestion(['addition'], 1, previous, counting)

    expect(next.displayText).toBe(previous.displayText)
    // One first draw plus MAX_REPEAT_RETRIES more, each using a bounded number of random numbers.
    expect(calls).toBeLessThan((MAX_REPEAT_RETRIES + 1) * 100)
  })

  it('refuses an empty list of operations', () => {
    expect(() => generateNextQuestion([], 1, { displayText: '1 + 1' })).toThrow(
      QuestionGenerationError,
    )
  })
})

describe('fallbackQuestion', () => {
  const every = MATH_OPERATIONS.flatMap((operation) =>
    DIFFICULTY_LEVELS.map((level) => [operation, level] as const),
  )

  it.each(every)('is a valid %s question at Level %i', (operation, level) => {
    const question = fallbackQuestion(operation, level)

    expect(getQuestionProblems(question)).toEqual([])
    expect(question).toMatchObject({
      operation,
      difficulty: level,
      source: 'regular',
    })
  })

  it('is the same question each time, apart from its id', () => {
    const { id: first, ...a } = fallbackQuestion('division', 3)
    const { id: second, ...b } = fallbackQuestion('division', 3)

    expect(a).toEqual(b)
    expect(first).not.toBe(second)
  })
})

describe('generateCheckedQuestion', () => {
  const good = () => fallbackQuestion('multiplication', 2)
  const bad = () => ({ ...good(), correctAnswer: good().correctAnswer + 1 })
  const silenced = () => vi.spyOn(console, 'error').mockImplementation(() => {})

  it('hands back a valid question at once, saying nothing', () => {
    const errors = silenced()
    const make = vi.fn(good)

    expect(getQuestionProblems(generateCheckedQuestion(make, bad))).toEqual([])
    expect(make).toHaveBeenCalledTimes(1)
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
  })

  it('tries again after an invalid question, and keeps the first valid one', () => {
    const errors = silenced()
    const valid = good()
    const make = vi
      .fn<() => ReturnType<typeof good>>()
      .mockReturnValueOnce(bad())
      .mockReturnValueOnce(bad())
      .mockReturnValueOnce(valid)
    const fallback = vi.fn(good)

    expect(generateCheckedQuestion(make, fallback)).toBe(valid)
    expect(make).toHaveBeenCalledTimes(3)
    expect(fallback).not.toHaveBeenCalled()
    expect(errors).toHaveBeenCalledTimes(2)
    errors.mockRestore()
  })

  it('tries again when making a question throws', () => {
    const errors = silenced()
    const valid = good()
    const make = vi
      .fn<() => ReturnType<typeof good>>()
      .mockImplementationOnce(() => {
        throw new Error('boom')
      })
      .mockReturnValueOnce(valid)

    expect(generateCheckedQuestion(make, bad)).toBe(valid)
    errors.mockRestore()
  })

  it('stops after the most attempts allowed, and uses the fallback', () => {
    const errors = silenced()
    const make = vi.fn(bad)
    const fallback = vi.fn(good)

    const question = generateCheckedQuestion(make, fallback)

    expect(make).toHaveBeenCalledTimes(MAX_GENERATION_ATTEMPTS)
    expect(fallback).toHaveBeenCalledTimes(1)
    expect(getQuestionProblems(question)).toEqual([])
    errors.mockRestore()
  })

  it('allows a few attempts, not one and not endless', () => {
    expect(MAX_GENERATION_ATTEMPTS).toBeGreaterThanOrEqual(3)
    expect(MAX_GENERATION_ATTEMPTS).toBeLessThanOrEqual(20)
  })

  it('takes another limit when given one', () => {
    const errors = silenced()
    const make = vi.fn(bad)

    generateCheckedQuestion(make, good, 2)

    expect(make).toHaveBeenCalledTimes(2)
    errors.mockRestore()
  })

  it('logs each failure for developers, saying what was wrong', () => {
    const errors = silenced()

    generateCheckedQuestion(bad, good, 1)

    expect(errors.mock.calls[0][0]).toMatch(
      /Made an invalid question, 0 × 0 \(attempt 1 of 1\): Correct answer 1 should be 0/,
    )
    expect(errors.mock.calls[1][0]).toMatch(/Using the fallback question/)
    errors.mockRestore()
  })

  it('throws only when even the fallback is invalid', () => {
    const errors = silenced()

    expect(() => generateCheckedQuestion(bad, bad, 1)).toThrow(
      QuestionGenerationError,
    )
    expect(() => generateCheckedQuestion(bad, bad, 1)).toThrow(
      /Even the fallback question is invalid/,
    )
    errors.mockRestore()
  })
})
