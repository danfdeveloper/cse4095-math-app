import { describe, expect, it } from 'vitest'
import type {
  DifficultyLevel,
  MathOperation,
  Question,
} from '../types/question'
import {
  getQuestionProblems,
  isDifficultyLevel,
  isPracticeConfig,
  isSupportedOperation,
  isValidQuestion,
  isWithinDifficultyRules,
} from './validation'

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    operation: 'multiplication',
    firstOperand: 7,
    secondOperand: 8,
    displayText: '7 × 8',
    correctAnswer: 56,
    choices: [48, 54, 56, 64],
    difficulty: 2,
    source: 'regular',
    ...overrides,
  }
}

describe('isSupportedOperation / isDifficultyLevel', () => {
  it('accept the four operations and four levels only', () => {
    for (const op of [
      'addition',
      'subtraction',
      'multiplication',
      'division',
    ]) {
      expect(isSupportedOperation(op)).toBe(true)
    }
    for (const level of [1, 2, 3, 4])
      expect(isDifficultyLevel(level)).toBe(true)

    expect(isSupportedOperation('power')).toBe(false)
    expect(isSupportedOperation('toString')).toBe(false)
    expect(isSupportedOperation(undefined)).toBe(false)
    expect(isDifficultyLevel(0)).toBe(false)
    expect(isDifficultyLevel(5)).toBe(false)
    expect(isDifficultyLevel('2')).toBe(false)
  })
})

type RuleCase = [
  operation: MathOperation,
  level: DifficultyLevel,
  first: number,
  second: number,
  allowed: boolean,
]

describe('isWithinDifficultyRules', () => {
  const cases: RuleCase[] = [
    // Addition
    ['addition', 1, 10, 10, true],
    ['addition', 1, 0, 0, true],
    ['addition', 1, 11, 0, false],
    ['addition', 1, 0, 11, false],
    ['addition', 2, 50, 50, true],
    ['addition', 2, 51, 0, false],
    ['addition', 3, 100, 100, true],
    ['addition', 3, 101, 1, false],
    ['addition', 4, 10, 1000, true],
    ['addition', 4, 1000, 1000, true],
    ['addition', 4, 9, 500, false], // needs multiple-digit numbers
    ['addition', 4, 1001, 10, false],
    // Subtraction (no negative answers)
    ['subtraction', 1, 10, 0, true],
    ['subtraction', 1, 5, 5, true],
    ['subtraction', 1, 4, 5, false],
    ['subtraction', 1, 11, 1, false],
    ['subtraction', 2, 50, 49, true],
    ['subtraction', 3, 100, 99, true],
    ['subtraction', 3, 50, 51, false],
    ['subtraction', 4, 1000, 10, true],
    ['subtraction', 4, 500, 600, false],
    ['subtraction', 4, 9, 5, false],
    // Multiplication
    ['multiplication', 1, 5, 5, true],
    ['multiplication', 1, 0, 5, true],
    ['multiplication', 1, 6, 1, false],
    ['multiplication', 2, 10, 10, true],
    ['multiplication', 2, 11, 2, false],
    ['multiplication', 3, 9, 9, true],
    ['multiplication', 3, 7, 48, true],
    ['multiplication', 3, 48, 7, true],
    ['multiplication', 3, 48, 12, false], // two-digit by two-digit
    ['multiplication', 3, 100, 1, false],
    ['multiplication', 4, 48, 7, true],
    ['multiplication', 4, 7, 48, true],
    ['multiplication', 4, 99, 99, true],
    ['multiplication', 4, 7, 8, false], // one-digit by one-digit
    ['multiplication', 4, 100, 2, false],
    // Division: first is the dividend, second is the divisor
    ['division', 1, 25, 5, true],
    ['division', 1, 0, 1, true],
    ['division', 1, 12, 3, true],
    ['division', 1, 30, 6, false], // divisor above 5
    ['division', 1, 30, 5, false], // answer above 5
    ['division', 1, 7, 2, false], // not a whole number
    ['division', 1, 5, 0, false], // divide by zero
    ['division', 2, 100, 10, true],
    ['division', 2, 110, 10, false],
    ['division', 3, 144, 12, true],
    ['division', 3, 143, 11, false],
    ['division', 4, 990, 99, true],
    ['division', 4, 146, 2, true],
    ['division', 4, 850, 25, true],
    ['division', 4, 1000, 2, true],
    ['division', 4, 144, 2, false], // dividend must be larger than Level 3's 144
    ['division', 4, 1001, 7, false],
    ['division', 4, 150, 1, false], // divisor 1 is not used at Level 4
  ]

  it.each(cases)(
    '%s at Level %i: %i and %i -> %s',
    (operation, level, first, second, allowed) => {
      expect(isWithinDifficultyRules(operation, first, second, level)).toBe(
        allowed,
      )
    },
  )
})

describe('getQuestionProblems', () => {
  it('finds nothing wrong with a valid question', () => {
    expect(getQuestionProblems(makeQuestion())).toEqual([])
    expect(isValidQuestion(makeQuestion())).toBe(true)
  })

  it('accepts valid questions for every operation', () => {
    const valid: Question[] = [
      makeQuestion({
        operation: 'addition',
        firstOperand: 8,
        secondOperand: 7,
        correctAnswer: 15,
        choices: [13, 14, 15, 25],
        difficulty: 1,
      }),
      makeQuestion({
        operation: 'subtraction',
        firstOperand: 40,
        secondOperand: 15,
        correctAnswer: 25,
        choices: [24, 25, 26, 35],
        difficulty: 2,
      }),
      makeQuestion({
        operation: 'division',
        firstOperand: 56,
        secondOperand: 7,
        correctAnswer: 8,
        choices: [6, 7, 8, 9],
        difficulty: 3,
      }),
    ]

    for (const question of valid)
      expect(getQuestionProblems(question)).toEqual([])
  })

  it('rejects an unsupported operation', () => {
    const problems = getQuestionProblems(
      makeQuestion({ operation: 'power' as never }),
    )

    expect(problems).toEqual(['Unsupported operation: power'])
  })

  it('rejects an unsupported difficulty level', () => {
    expect(
      getQuestionProblems(makeQuestion({ difficulty: 9 as never })),
    ).toEqual(['Unsupported difficulty level: 9'])
  })

  it('rejects operands that are not whole numbers', () => {
    expect(getQuestionProblems(makeQuestion({ firstOperand: 7.5 }))).toContain(
      'Operands must be whole numbers',
    )
    expect(
      getQuestionProblems(makeQuestion({ secondOperand: Number.NaN })),
    ).toContain('Operands must be whole numbers')
  })

  it('rejects division by zero', () => {
    const problems = getQuestionProblems(
      makeQuestion({
        operation: 'division',
        firstOperand: 8,
        secondOperand: 0,
        correctAnswer: Infinity,
      }),
    )

    expect(problems).toEqual(['Division by zero'])
  })

  it('rejects a division that is not a whole number', () => {
    const problems = getQuestionProblems(
      makeQuestion({
        operation: 'division',
        firstOperand: 7,
        secondOperand: 2,
        correctAnswer: 3.5,
        difficulty: 3,
      }),
    )

    expect(problems).toContain('Division answers must be whole numbers')
  })

  it('rejects a wrong correct answer', () => {
    expect(getQuestionProblems(makeQuestion({ correctAnswer: 54 }))).toEqual([
      'Correct answer 54 should be 56',
    ])
  })

  it('rejects an answer that is not a finite number', () => {
    for (const correctAnswer of [Number.NaN, Infinity]) {
      const problems = getQuestionProblems(makeQuestion({ correctAnswer }))

      expect(problems.some((p) => p.startsWith('Correct answer'))).toBe(true)
    }
  })

  it('rejects a question that does not match its difficulty level', () => {
    const problems = getQuestionProblems(
      makeQuestion({
        firstOperand: 12,
        secondOperand: 11,
        correctAnswer: 132,
        choices: [120, 130, 132, 140],
      }),
    )

    expect(problems).toEqual(['12 × 11 is outside the Level 2 rules'])
  })

  it('rejects a negative subtraction answer', () => {
    const problems = getQuestionProblems(
      makeQuestion({
        operation: 'subtraction',
        firstOperand: 3,
        secondOperand: 5,
        correctAnswer: -2,
        difficulty: 1,
      }),
    )

    expect(problems).toContain('3 − 5 is outside the Level 1 rules')
  })

  it('rejects a missing id or display text', () => {
    expect(getQuestionProblems(makeQuestion({ id: '' }))).toContain(
      'The question has no id',
    )
    expect(getQuestionProblems(makeQuestion({ displayText: '' }))).toContain(
      'The question has no display text',
    )
  })

  it('reports every problem at once', () => {
    const problems = getQuestionProblems(
      makeQuestion({
        id: '',
        correctAnswer: 1,
        firstOperand: 12,
        secondOperand: 11,
        choices: [1, 2, 3, 4],
      }),
    )

    expect(problems).toHaveLength(3)
    expect(isValidQuestion(makeQuestion({ correctAnswer: 1 }))).toBe(false)
  })

  describe('answer choices', () => {
    const problemsFor = (choices: number[]) =>
      getQuestionProblems(makeQuestion({ choices }))

    it('accepts the four choices from the specification example in any order', () => {
      expect(problemsFor([64, 48, 56, 54])).toEqual([])
      expect(problemsFor([56, 54, 64, 48])).toEqual([])
    })

    it.each([[[]], [[56]], [[48, 54, 56]], [[48, 54, 56, 64, 72]]])(
      'requires exactly four choices (got %j)',
      (choices) => {
        expect(problemsFor(choices)).toEqual([
          'There must be exactly 4 answer choices',
        ])
      },
    )

    it('rejects choices that are not an array', () => {
      expect(
        getQuestionProblems(makeQuestion({ choices: undefined as never })),
      ).toEqual(['There must be exactly 4 answer choices'])
    })

    it('requires every choice to be unique', () => {
      expect(problemsFor([48, 48, 56, 64])).toEqual([
        'Answer choices must be unique',
      ])
    })

    it('requires the correct answer to be one of the choices', () => {
      expect(problemsFor([48, 54, 55, 64])).toEqual([
        'Exactly one answer choice must equal the correct answer',
      ])
    })

    it('rejects the correct answer appearing twice', () => {
      expect(problemsFor([56, 56, 54, 64])).toEqual([
        'Answer choices must be unique',
        'Exactly one answer choice must equal the correct answer',
      ])
    })

    it('rejects choices that are not whole numbers', () => {
      expect(problemsFor([48, 54.5, 56, 64])).toEqual([
        'Answer choices must be whole numbers',
      ])
    })

    it('rejects negative choices', () => {
      expect(problemsFor([-8, 54, 56, 64])).toEqual([
        'Answer choices cannot be negative',
      ])
    })
  })
})

describe('isPracticeConfig', () => {
  const valid = {
    operations: ['addition', 'division'],
    difficulty: 2,
    sessionLength: 10,
  }

  it('accepts a normal setup', () => {
    expect(isPracticeConfig(valid)).toBe(true)
  })

  it('accepts continuous practice and every operation', () => {
    expect(
      isPracticeConfig({
        operations: ['addition', 'subtraction', 'multiplication', 'division'],
        difficulty: 4,
        sessionLength: 'continuous',
      }),
    ).toBe(true)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'addition'],
    ['a number', 7],
    ['an empty object', {}],
    ['an array', []],
  ])('rejects %s', (_, value) => {
    expect(isPracticeConfig(value)).toBe(false)
  })

  it.each([
    ['no operations', { ...valid, operations: [] }],
    ['operations that are not a list', { ...valid, operations: 'addition' }],
    ['an unknown operation', { ...valid, operations: ['addition', 'power'] }],
    ['a missing difficulty', { ...valid, difficulty: undefined }],
    ['difficulty 0', { ...valid, difficulty: 0 }],
    ['difficulty 5', { ...valid, difficulty: 5 }],
    ['difficulty as text', { ...valid, difficulty: '2' }],
    ['a missing session length', { ...valid, sessionLength: undefined }],
    ['a session length of 0', { ...valid, sessionLength: 0 }],
    ['a negative session length', { ...valid, sessionLength: -5 }],
    ['a fractional session length', { ...valid, sessionLength: 2.5 }],
    ['a NaN session length', { ...valid, sessionLength: Number.NaN }],
    ['an unknown session length word', { ...valid, sessionLength: 'forever' }],
  ])('rejects %s', (_, value) => {
    expect(isPracticeConfig(value)).toBe(false)
  })
})
