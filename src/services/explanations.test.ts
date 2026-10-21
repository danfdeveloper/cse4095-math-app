import { describe, expect, it } from 'vitest'
import {
  DIFFICULTY_LEVELS,
  MATH_OPERATIONS,
  OPERATION_INFO,
} from '../constants/practice'
import { seededRandom } from '../test/seededRandom'
import { wrongEquations } from '../test/equations'
import type { MathOperation } from '../types/question'
import { calculateAnswer } from '../utils/math'
import {
  EXPLANATION_METHODS,
  explainQuestion,
  FALLBACK_METHOD,
  type Explanation,
} from './explanations'
import { generateQuestion } from './questionGenerator'

/** The explanation for a question made from just its numbers. */
function explain(operation: MathOperation, a: number, b: number): Explanation {
  const answer = calculateAnswer(operation, a, b)
  return explainQuestion({
    operation,
    firstOperand: a,
    secondOperand: b,
    correctAnswer: answer,
    displayText: `${a} ${OPERATION_INFO[operation].symbol} ${b}`,
  })
}

const add = (a: number, b: number) => explain('addition', a, b)
const subtract = (a: number, b: number) => explain('subtraction', a, b)
const multiply = (a: number, b: number) => explain('multiplication', a, b)
const divide = (n: number, d: number) => explain('division', n, d)

describe('addition', () => {
  it('adding zero', () => {
    expect(add(5, 0)).toEqual({
      method: 'Adding zero',
      steps: ['Adding 0 does not change a number.', 'So 5 + 0 = 5.'],
    })
    expect(add(0, 9).method).toBe('Adding zero')
    expect(add(0, 0).method).toBe('Adding zero')
  })

  it('doubles', () => {
    expect(add(7, 7)).toEqual({
      method: 'Doubles',
      steps: [
        'Both numbers are 7, so this is a double: the same number twice.',
        'So 7 + 7 = 14.',
      ],
    })
    expect(add(10, 10).method).toBe('Doubles')
    expect(add(1, 1).method).toBe('Doubles')
  })

  it('counting on, when the answer is 10 or less', () => {
    expect(add(3, 4)).toEqual({
      method: 'Counting on',
      steps: ['Start at 4 and count on 3: 5, 6, 7.', 'So 3 + 4 = 7.'],
    })
    expect(add(1, 9).steps[0]).toBe('Start at 9 and count on 1: 10.')
    expect(add(4, 6).steps[0]).toBe('Start at 6 and count on 4: 7, 8, 9, 10.')
  })

  it('adding ten', () => {
    expect(add(10, 7)).toEqual({
      method: 'Adding ten',
      steps: [
        'Ten and 7 more: the 1 ten stays, and 7 goes in the ones place.',
        'So 10 + 7 = 17.',
      ],
    })
    expect(add(3, 10).method).toBe('Adding ten')
  })

  it('making a ten, when the answer is over 10', () => {
    expect(add(8, 7)).toEqual({
      method: 'Making a ten',
      steps: [
        '8 needs 2 more to make 10.',
        'Take 2 from 7, which leaves 7 − 2 = 5.',
        '10 + 5 = 15.',
        'So 8 + 7 = 15.',
      ],
    })
  })

  it('making a ten gives the same working whichever number comes first', () => {
    expect(add(7, 8).steps.slice(0, 3)).toEqual(add(8, 7).steps.slice(0, 3))
    expect(add(7, 8).steps[3]).toBe('So 7 + 8 = 15.')
  })

  it('making a ten works from 9 as well', () => {
    expect(add(9, 5).steps).toEqual([
      '9 needs 1 more to make 10.',
      'Take 1 from 5, which leaves 5 − 1 = 4.',
      '10 + 4 = 14.',
      'So 9 + 5 = 14.',
    ])
  })

  it('adding whole tens', () => {
    expect(add(40, 30)).toEqual({
      method: 'Adding whole tens',
      steps: [
        'Both numbers are whole tens, so add the tens digits.',
        '4 + 3 = 7, and 7 tens is 70.',
        'So 40 + 30 = 70.',
      ],
    })
    expect(add(10, 40).method).toBe('Adding whole tens')
    expect(add(60, 70).steps[1]).toBe('6 + 7 = 13, and 13 tens is 130.')
  })

  describe('column addition', () => {
    it('with a carry', () => {
      expect(add(47, 38)).toEqual({
        method: 'Column addition',
        steps: [
          'Ones: 7 + 8 = 15. Write 5 and carry 1.',
          'Tens: 4 + 3 + 1 = 8 (the extra 1 was carried).',
          'So 47 + 38 = 85.',
        ],
      })
    })

    it('without a carry', () => {
      expect(add(23, 41).steps).toEqual([
        'Ones: 3 + 1 = 4.',
        'Tens: 2 + 4 = 6.',
        'So 23 + 41 = 64.',
      ])
    })

    it('brings down digits that have nothing to add to them', () => {
      expect(add(123, 4).steps).toEqual([
        'Ones: 3 + 4 = 7.',
        'Tens: bring down the 2.',
        'Hundreds: bring down the 1.',
        'So 123 + 4 = 127.',
      ])
    })

    it('carries a one all the way across', () => {
      expect(add(999, 1).steps).toEqual([
        'Ones: 9 + 1 = 10. Write 0 and carry 1.',
        'Tens: 9 + 1 = 10 (the extra 1 was carried). Write 0 and carry 1.',
        'Hundreds: 9 + 1 = 10 (the extra 1 was carried).',
        'So 999 + 1 = 1000.',
      ])
    })

    it('adds the biggest numbers', () => {
      expect(add(1000, 1000).steps).toEqual([
        'Ones: 0 + 0 = 0.',
        'Tens: 0 + 0 = 0.',
        'Hundreds: 0 + 0 = 0.',
        'Thousands: 1 + 1 = 2.',
        'So 1000 + 1000 = 2000.',
      ])
    })

    it('carries into a column that has only one digit', () => {
      expect(add(95, 7).steps).toEqual([
        'Ones: 5 + 7 = 12. Write 2 and carry 1.',
        'Tens: 9 + 1 = 10 (the extra 1 was carried).',
        'So 95 + 7 = 102.',
      ])
    })
  })
})

describe('subtraction', () => {
  it('subtracting zero', () => {
    expect(subtract(6, 0)).toEqual({
      method: 'Subtracting zero',
      steps: ['Taking away 0 leaves the number as it is.', 'So 6 − 0 = 6.'],
    })
  })

  it('taking away the same number', () => {
    expect(subtract(4, 4)).toEqual({
      method: 'Taking away the same number',
      steps: [
        'Taking a number away from itself leaves nothing.',
        'So 4 − 4 = 0.',
      ],
    })
    expect(subtract(80, 80).method).toBe('Taking away the same number')
  })

  it('counting back, for taking away 1, 2 or 3', () => {
    expect(subtract(9, 2)).toEqual({
      method: 'Counting back',
      steps: ['Start at 9 and count back 2: 8, 7.', 'So 9 − 2 = 7.'],
    })
    expect(subtract(10, 3).steps[0]).toBe(
      'Start at 10 and count back 3: 9, 8, 7.',
    )
    expect(subtract(5, 1).steps[0]).toBe('Start at 5 and count back 1: 4.')
  })

  it('thinking addition, for the rest of the small ones', () => {
    expect(subtract(10, 4)).toEqual({
      method: 'Thinking addition',
      steps: [
        'Think: what do you add to 4 to make 10?',
        '4 + 6 = 10.',
        'So 10 − 4 = 6.',
      ],
    })
  })

  describe('column subtraction', () => {
    it('with a borrow', () => {
      expect(subtract(52, 38)).toEqual({
        method: 'Column subtraction',
        steps: [
          'Ones: 2 is too small, so borrow 1 ten. 12 − 8 = 4.',
          'Tens: 5 − 1 − 3 = 1 (the 1 was lent to the column on the right).',
          'So 52 − 38 = 14.',
        ],
      })
    })

    it('without a borrow', () => {
      expect(subtract(79, 35).steps).toEqual([
        'Ones: 9 − 5 = 4.',
        'Tens: 7 − 3 = 4.',
        'So 79 − 35 = 44.',
      ])
    })

    it('shows taking away 0 in a column', () => {
      expect(subtract(52, 30).steps).toEqual([
        'Ones: 2 − 0 = 2.',
        'Tens: 5 − 3 = 2.',
        'So 52 − 30 = 22.',
      ])
    })

    it('borrows across a zero', () => {
      expect(subtract(500, 123).steps).toEqual([
        'Ones: 0 is too small, so borrow 1 ten. 10 − 3 = 7.',
        'Tens: 0 is too small after the 1 that was lent, so borrow 1 hundred. 10 − 1 − 2 = 7.',
        'Hundreds: 5 − 1 − 1 = 3 (the 1 was lent to the column on the right).',
        'So 500 − 123 = 377.',
      ])
    })

    it('borrows through a run of zeros', () => {
      expect(subtract(1000, 1).steps).toEqual([
        'Ones: 0 is too small, so borrow 1 ten. 10 − 1 = 9.',
        'Tens: 0 is too small after the 1 that was lent, so borrow 1 hundred. 10 − 1 = 9.',
        'Hundreds: 0 is too small after the 1 that was lent, so borrow 1 thousand. 10 − 1 = 9.',
        'Thousands: 1 − 1 = 0 (the 1 was lent to the column on the right).',
        'So 1000 − 1 = 999.',
      ])
    })

    it('handles a one-digit number taken from a two-digit one', () => {
      expect(subtract(40, 5).steps).toEqual([
        'Ones: 0 is too small, so borrow 1 ten. 10 − 5 = 5.',
        'Tens: 4 − 1 = 3 (the 1 was lent to the column on the right).',
        'So 40 − 5 = 35.',
      ])
    })
  })
})

describe('multiplication', () => {
  it('times zero, either way round', () => {
    expect(multiply(0, 5)).toEqual({
      method: 'Times zero',
      steps: [
        'Zero groups, or groups with nothing in them, always make 0.',
        'So 0 × 5 = 0.',
      ],
    })
    expect(multiply(7, 0).method).toBe('Times zero')
    expect(multiply(0, 0).method).toBe('Times zero')
  })

  it('times one, either way round', () => {
    expect(multiply(1, 9)).toEqual({
      method: 'Times one',
      steps: ['One group of a number is just that number.', 'So 1 × 9 = 9.'],
    })
    expect(multiply(6, 1).method).toBe('Times one')
  })

  it('times ten, even with a big number', () => {
    expect(multiply(10, 7)).toEqual({
      method: 'Times ten',
      steps: ['To multiply by 10, put a 0 on the end of 7.', 'So 10 × 7 = 70.'],
    })
    expect(multiply(7, 10).steps[0]).toBe(
      'To multiply by 10, put a 0 on the end of 7.',
    )
    expect(multiply(10, 25).steps[0]).toBe(
      'To multiply by 10, put a 0 on the end of 25.',
    )
  })

  it('doubling', () => {
    expect(multiply(2, 7)).toEqual({
      method: 'Doubling',
      steps: ['Times 2 is the same as doubling: 7 + 7 = 14.', 'So 2 × 7 = 14.'],
    })
    expect(multiply(7, 2).steps[0]).toBe(
      'Times 2 is the same as doubling: 7 + 7 = 14.',
    )
    expect(multiply(2, 9).method).toBe('Doubling')
  })

  it('half of ten groups, for fives', () => {
    expect(multiply(5, 8)).toEqual({
      method: 'Half of ten groups',
      steps: [
        'Five is half of ten, so find 10 groups and take half.',
        '10 × 8 = 80, and 80 ÷ 2 = 40.',
        'So 5 × 8 = 40.',
      ],
    })
    expect(multiply(7, 5).steps[1]).toBe('10 × 7 = 70, and 70 ÷ 2 = 35.')
    expect(multiply(5, 5).steps[1]).toBe('10 × 5 = 50, and 50 ÷ 2 = 25.')
  })

  it('ten groups minus one, for nines', () => {
    expect(multiply(9, 6)).toEqual({
      method: 'Ten groups minus one',
      steps: [
        'Nine is one less than ten, so find 10 groups and take one group away.',
        '10 × 6 = 60, and 60 − 6 = 54.',
        'So 9 × 6 = 54.',
      ],
    })
    expect(multiply(7, 9).steps[1]).toBe('10 × 7 = 70, and 70 − 7 = 63.')
    expect(multiply(9, 9).steps[1]).toBe('10 × 9 = 90, and 90 − 9 = 81.')
  })

  it('repeated addition, for 3s and 4s', () => {
    expect(multiply(3, 7)).toEqual({
      method: 'Repeated addition',
      steps: [
        '3 groups of 7 is 7 added 3 times.',
        '7 + 7 + 7 = 21.',
        'So 3 × 7 = 21.',
      ],
    })
    expect(multiply(6, 4).steps).toEqual([
      '4 groups of 6 is 6 added 4 times.',
      '6 + 6 + 6 + 6 = 24.',
      'So 6 × 4 = 24.',
    ])
    expect(multiply(3, 3).steps[1]).toBe('3 + 3 + 3 = 9.')
  })

  it('splitting with fives, for 6, 7 and 8', () => {
    expect(multiply(7, 8)).toEqual({
      method: 'Splitting with fives',
      steps: [
        'Split 7 into 5 and 2.',
        '5 × 8 = 40, and 2 × 8 = 16.',
        '40 + 16 = 56.',
        'So 7 × 8 = 56.',
      ],
    })
    expect(multiply(8, 7).steps.slice(0, 3)).toEqual(
      multiply(7, 8).steps.slice(0, 3),
    )
    expect(multiply(6, 6).steps).toEqual([
      'Split 6 into 5 and 1.',
      '5 × 6 = 30, and 1 × 6 = 6.',
      '30 + 6 = 36.',
      'So 6 × 6 = 36.',
    ])
    expect(multiply(8, 8).steps[1]).toBe('5 × 8 = 40, and 3 × 8 = 24.')
  })

  describe('with zeros', () => {
    it('one zero', () => {
      expect(multiply(30, 6)).toEqual({
        method: 'Multiplying with zeros',
        steps: [
          'Leave out the zero for now: 3 × 6 = 18.',
          'Put the zero back on the end: 180.',
          'So 30 × 6 = 180.',
        ],
      })
    })

    it('two zeros', () => {
      expect(multiply(40, 50).steps).toEqual([
        'Leave out the zeros for now: 4 × 5 = 20.',
        'Put the 2 zeros back on the end: 2000.',
        'So 40 × 50 = 2000.',
      ])
    })

    it('a zero on either factor', () => {
      expect(multiply(38, 70).steps).toEqual([
        'Leave out the zero for now: 38 × 7 = 266.',
        'Put the zero back on the end: 2660.',
        'So 38 × 70 = 2660.',
      ])
    })
  })

  describe('splitting into tens and ones', () => {
    it('two digits by two digits splits the second number', () => {
      expect(multiply(38, 76)).toEqual({
        method: 'Splitting into tens and ones',
        steps: [
          'Split 76 into 70 and 6.',
          '38 × 70 = 2660, and 38 × 6 = 228.',
          '2660 + 228 = 2888.',
          'So 38 × 76 = 2888.',
        ],
      })
    })

    it('one digit by two digits splits the two-digit number', () => {
      expect(multiply(7, 48).steps).toEqual([
        'Split 48 into 40 and 8.',
        '7 × 40 = 280, and 7 × 8 = 56.',
        '280 + 56 = 336.',
        'So 7 × 48 = 336.',
      ])
    })

    it('keeps the numbers in the order of the question when the two-digit number is first', () => {
      expect(multiply(48, 7).steps).toEqual([
        'Split 48 into 40 and 8.',
        '40 × 7 = 280, and 8 × 7 = 56.',
        '280 + 56 = 336.',
        'So 48 × 7 = 336.',
      ])
    })

    it('is used for a small number times a number just over ten', () => {
      expect(multiply(5, 12).steps).toEqual([
        'Split 12 into 10 and 2.',
        '5 × 10 = 50, and 5 × 2 = 10.',
        '50 + 10 = 60.',
        'So 5 × 12 = 60.',
      ])
    })
  })
})

describe('division', () => {
  it('dividing zero', () => {
    expect(divide(0, 5)).toEqual({
      method: 'Dividing zero',
      steps: [
        'There is nothing to share, so every group gets 0.',
        'So 0 ÷ 5 = 0.',
      ],
    })
  })

  it('dividing by one', () => {
    expect(divide(9, 1)).toEqual({
      method: 'Dividing by one',
      steps: ['Dividing by 1 leaves the number as it is.', 'So 9 ÷ 1 = 9.'],
    })
  })

  it('dividing a number by itself', () => {
    expect(divide(6, 6)).toEqual({
      method: 'Dividing a number by itself',
      steps: ['A number divided by itself is always 1.', 'So 6 ÷ 6 = 1.'],
    })
  })

  it('dividing by ten', () => {
    expect(divide(70, 10)).toEqual({
      method: 'Dividing by ten',
      steps: [
        'To divide by 10, take a 0 off the end of 70.',
        'So 70 ÷ 10 = 7.',
      ],
    })
    expect(divide(150, 10).steps[0]).toBe(
      'To divide by 10, take a 0 off the end of 150.',
    )
  })

  it('halving', () => {
    expect(divide(14, 2)).toEqual({
      method: 'Halving',
      steps: [
        'Dividing by 2 means finding half.',
        '7 + 7 = 14, so half of 14 is 7.',
        'So 14 ÷ 2 = 7.',
      ],
    })
    expect(divide(146, 2).steps[1]).toBe('73 + 73 = 146, so half of 146 is 73.')
  })

  it('thinking multiplication, through the times tables', () => {
    expect(divide(56, 7)).toEqual({
      method: 'Thinking multiplication',
      steps: [
        'Division undoes multiplication. Ask: 7 times what makes 56?',
        '7 × 8 = 56.',
        'So 56 ÷ 7 = 8.',
      ],
    })
    expect(divide(144, 12).method).toBe('Thinking multiplication')
    expect(divide(36, 4).steps[1]).toBe('4 × 9 = 36.')
  })

  describe('long division', () => {
    it('a three-digit number by one digit', () => {
      expect(divide(648, 9)).toEqual({
        method: 'Long division',
        steps: [
          'How many 9s fit into 64? 7, because 7 × 9 = 63. Subtract: 64 − 63 = 1.',
          'Bring down the 8: that makes 18. How many 9s fit into 18? 2, because 2 × 9 = 18. Nothing is left over.',
          'Check by multiplying: 72 × 9 = 648.',
          'So 648 ÷ 9 = 72.',
        ],
      })
    })

    it('by a two-digit number', () => {
      expect(divide(979, 89).steps).toEqual([
        'How many 89s fit into 97? 1, because 1 × 89 = 89. Subtract: 97 − 89 = 8.',
        'Bring down the 9: that makes 89. How many 89s fit into 89? 1, because 1 × 89 = 89. Nothing is left over.',
        'Check by multiplying: 11 × 89 = 979.',
        'So 979 ÷ 89 = 11.',
      ])
    })

    it('writes a 0 in the answer when the divisor does not fit', () => {
      expect(divide(630, 7).steps).toEqual([
        'How many 7s fit into 63? 9, because 9 × 7 = 63. Nothing is left over.',
        'Bring down the 0: that makes 0. 7 does not fit into 0, so write 0. Nothing is left over.',
        'Check by multiplying: 90 × 7 = 630.',
        'So 630 ÷ 7 = 90.',
      ])
    })

    it('carries a remainder through several steps', () => {
      expect(divide(1000, 8).steps).toEqual([
        'How many 8s fit into 10? 1, because 1 × 8 = 8. Subtract: 10 − 8 = 2.',
        'Bring down the 0: that makes 20. How many 8s fit into 20? 2, because 2 × 8 = 16. Subtract: 20 − 16 = 4.',
        'Bring down the 0: that makes 40. How many 8s fit into 40? 5, because 5 × 8 = 40. Nothing is left over.',
        'Check by multiplying: 125 × 8 = 1000.',
        'So 1000 ÷ 8 = 125.',
      ])
    })

    it('is used whenever the table facts do not apply', () => {
      expect(divide(156, 12).method).toBe('Long division') // 13 twelves
      expect(divide(1000, 2).method).toBe('Halving')
      expect(divide(850, 25).method).toBe('Long division')
    })
  })
})

describe('questions that do not add up', () => {
  const base = {
    operation: 'multiplication' as const,
    firstOperand: 7,
    secondOperand: 8,
    correctAnswer: 56,
    displayText: '7 × 8',
  }

  it('get only a plain statement, never a wrong method', () => {
    expect(explainQuestion({ ...base, correctAnswer: 55 })).toEqual({
      method: FALLBACK_METHOD,
      steps: ['So 7 × 8 = 55.'],
    })
  })

  it.each([
    ['a wrong sum', { operation: 'addition' as const, correctAnswer: 14 }],
    [
      'a wrong difference',
      {
        operation: 'subtraction' as const,
        firstOperand: 8,
        secondOperand: 7,
        correctAnswer: 2,
      },
    ],
    [
      'a negative difference',
      {
        operation: 'subtraction' as const,
        firstOperand: 3,
        secondOperand: 5,
        correctAnswer: -2,
      },
    ],
    [
      'a division that is not whole',
      {
        operation: 'division' as const,
        firstOperand: 7,
        secondOperand: 2,
        correctAnswer: 3.5,
      },
    ],
    [
      'division by zero',
      {
        operation: 'division' as const,
        firstOperand: 8,
        secondOperand: 0,
        correctAnswer: 0,
      },
    ],
    [
      'zero divided by zero',
      {
        operation: 'division' as const,
        firstOperand: 0,
        secondOperand: 0,
        correctAnswer: 5,
      },
    ],
    ['a fractional operand', { firstOperand: 7.5 }],
    ['a negative operand', { firstOperand: -7 }],
    // These are true sums, so only the whole-number rule keeps them out.
    [
      'a negative operand in a true addition',
      {
        operation: 'addition' as const,
        firstOperand: -3,
        secondOperand: 5,
        correctAnswer: 2,
      },
    ],
    [
      'a negative answer in a true addition',
      {
        operation: 'addition' as const,
        firstOperand: 3,
        secondOperand: -5,
        correctAnswer: -2,
      },
    ],
    [
      'a negative operand in a true subtraction',
      {
        operation: 'subtraction' as const,
        firstOperand: 5,
        secondOperand: -3,
        correctAnswer: 8,
      },
    ],
    [
      'two negative operands in a true multiplication',
      { firstOperand: -2, secondOperand: -3, correctAnswer: 6 },
    ],
    [
      'two negative operands in a true division',
      {
        operation: 'division' as const,
        firstOperand: -6,
        secondOperand: -3,
        correctAnswer: 2,
      },
    ],
    ['an unsupported operation', { operation: 'power' as never }],
    ['a NaN answer', { correctAnswer: Number.NaN }],
  ])('use the fallback for %s', (_, change) => {
    const explanation = explainQuestion({ ...base, ...change })

    expect(explanation.method).toBe(FALLBACK_METHOD)
    expect(explanation.steps).toHaveLength(1)
  })

  it('never throw', () => {
    expect(() =>
      explainQuestion({ ...base, operation: 'nonsense' as never }),
    ).not.toThrow()
    expect(() =>
      explainQuestion({ ...base, firstOperand: Infinity }),
    ).not.toThrow()
  })
})

describe('every explanation, for every kind of question', () => {
  /** What must be true of any explanation of 'question'. */
  function expectSound(operation: MathOperation, a: number, b: number) {
    const question = {
      operation,
      firstOperand: a,
      secondOperand: b,
      correctAnswer: calculateAnswer(operation, a, b),
      displayText: `${a} ${OPERATION_INFO[operation].symbol} ${b}`,
    }
    const { method, steps } = explainQuestion(question)
    const text = steps.join(' ')

    // Thousands of cases run through here, so the checks are plain code that
    // gathers what is wrong and asserts once. A dozen expect() calls per case
    // made these tests slow enough to time out when the machine was busy.
    const problems: string[] = []
    // It ends by stating the whole answer, for this very problem.
    const conclusion = `So ${question.displayText} = ${question.correctAnswer}.`
    if (steps.at(-1) !== conclusion)
      problems.push(`ends with "${steps.at(-1)}", not "${conclusion}"`)
    // Every equation it writes is true.
    const wrong = wrongEquations(text)
    if (wrong.length > 0) problems.push(`false equations: ${wrong.join(' | ')}`)
    // It names one of the methods that exist for this operation.
    if (!(EXPLANATION_METHODS[operation] as readonly string[]).includes(method))
      problems.push(`"${method}" is not a method of ${operation}`)
    // It is brief: a handful of short steps.
    if (steps.length < 2 || steps.length > 7)
      problems.push(`${steps.length} steps`)
    for (const step of steps)
      if (step.length > 150) problems.push(`step is too long: ${step}`)
    // Nothing broken got through.
    if (/NaN|undefined|Infinity|null/.test(text))
      problems.push('contains broken text')
    if (/[−-]\d+ [+−×÷]|= [−-]\d/.test(text))
      problems.push('contains a negative number')

    expect(problems, question.displayText).toEqual([])
    return { method, steps }
  }

  it('is sound for every addition from 0 to 20', () => {
    for (let a = 0; a <= 20; a++)
      for (let b = 0; b <= 20; b++) expectSound('addition', a, b)
  })

  it('is sound for every subtraction from 0 to 20', () => {
    for (let a = 0; a <= 20; a++)
      for (let b = 0; b <= a; b++) expectSound('subtraction', a, b)
  })

  it('is sound for every multiplication from 0 to 20', () => {
    for (let a = 0; a <= 20; a++)
      for (let b = 0; b <= 20; b++) expectSound('multiplication', a, b)
  })

  it('is sound for every division with a divisor and answer from 0 to 20', () => {
    for (let d = 1; d <= 20; d++)
      for (let q = 0; q <= 20; q++) expectSound('division', d * q, d)
  })

  it('is sound for 4000 random additions and subtractions up to 1,000', () => {
    const random = seededRandom(2025)
    const pick = () => Math.floor(random() * 1001)
    for (let i = 0; i < 2000; i++) {
      expectSound('addition', pick(), pick())
      const [x, y] = [pick(), pick()].sort((m, n) => n - m)
      expectSound('subtraction', x, y)
    }
  })

  it('is sound for 3000 random multiplications up to 99', () => {
    const random = seededRandom(2026)
    for (let i = 0; i < 3000; i++) {
      expectSound(
        'multiplication',
        Math.floor(random() * 100),
        Math.floor(random() * 100),
      )
    }
  })

  it('is sound for 3000 random divisions with dividends up to 1,000', () => {
    const random = seededRandom(2027)
    for (let i = 0; i < 3000; i++) {
      const divisor = 1 + Math.floor(random() * 99)
      const quotient = Math.floor((random() * 1000) / divisor)
      expectSound('division', divisor * quotient, divisor)
    }
  })

  it.each(MATH_OPERATIONS)(
    'is sound for real %s questions at every level',
    (operation) => {
      const random = seededRandom(7)
      for (const level of DIFFICULTY_LEVELS) {
        for (let i = 0; i < 250; i++) {
          const q = generateQuestion(operation, level, random)
          expectSound(operation, q.firstOperand, q.secondOperand)
        }
      }
    },
  )

  it('uses every method it names, so the list of names is accurate', () => {
    const used: Record<MathOperation, Set<string>> = {
      addition: new Set(),
      subtraction: new Set(),
      multiplication: new Set(),
      division: new Set(),
    }
    for (let a = 0; a <= 30; a++) {
      for (let b = 0; b <= 30; b++) {
        used.addition.add(add(a, b).method)
        used.multiplication.add(multiply(a, b).method)
        if (b <= a) used.subtraction.add(subtract(a, b).method)
      }
    }
    for (const operand of [999, 1000, 500, 130, 100])
      used.addition.add(add(operand, 11).method)
    for (let d = 1; d <= 40; d++) {
      for (let q = 0; q <= 40; q++) used.division.add(divide(d * q, d).method)
    }

    for (const operation of MATH_OPERATIONS) {
      expect([...used[operation]].sort(), operation).toEqual(
        [...EXPLANATION_METHODS[operation]].sort(),
      )
    }
  })
})

describe('the same kind of problem always gets the same method', () => {
  it('addition does not depend on which number is first', () => {
    for (let a = 0; a <= 40; a++) {
      for (let b = 0; b <= 40; b++)
        expect(add(a, b).method, `${a}+${b}`).toBe(add(b, a).method)
    }
  })

  it('multiplication does not depend on which number is first', () => {
    for (let a = 0; a <= 40; a++) {
      for (let b = 0; b <= 40; b++) {
        expect(multiply(a, b).method, `${a}×${b}`).toBe(multiply(b, a).method)
      }
    }
  })

  it('every 2 times fact is doubling, every 5 fact is half of ten groups, every 9 fact is ten groups minus one', () => {
    // 10 is left out: it has its own, clearer rule, "put a 0 on the end".
    for (let n = 3; n <= 9; n++) {
      if (n !== 5 && n !== 9) expect(multiply(2, n).method).toBe('Doubling')
      if (n !== 9) expect(multiply(5, n).method).toBe('Half of ten groups')
      if (n !== 5) expect(multiply(9, n).method).toBe('Ten groups minus one')
    }
    expect(multiply(2, 5).method).toBe('Doubling')
    expect(multiply(2, 9).method).toBe('Doubling')
    expect(multiply(5, 9).method).toBe('Half of ten groups')
    expect(multiply(2, 10).method).toBe('Times ten')
    expect(multiply(5, 10).method).toBe('Times ten')
  })

  it('every times-table division is thinking multiplication', () => {
    for (const d of [3, 4, 5, 6, 7, 8, 9, 11, 12]) {
      for (let q = 2; q <= 12; q++) {
        expect(divide(d * q, d).method, `${d * q}÷${d}`).toBe(
          d * q === d
            ? 'Dividing a number by itself'
            : 'Thinking multiplication',
        )
      }
    }
  })

  it('every Level 4 division uses long division, apart from the quick rules', () => {
    const random = seededRandom(99)
    const quick = new Set(['Dividing by ten', 'Halving'])
    for (let i = 0; i < 400; i++) {
      const q = generateQuestion('division', 4, random)
      const { method } = explain('division', q.firstOperand, q.secondOperand)

      expect(
        quick.has(method) || method === 'Long division',
        `${q.displayText}: ${method}`,
      ).toBe(true)
    }
  })

  it('gives the same explanation every time for the same question', () => {
    expect(multiply(38, 76)).toEqual(multiply(38, 76))
    expect(divide(648, 9)).toEqual(divide(648, 9))
  })

  it('does not change the question it is given', () => {
    const question = {
      operation: 'addition' as const,
      firstOperand: 47,
      secondOperand: 38,
      correctAnswer: 85,
      displayText: '47 + 38',
    }
    const snapshot = JSON.stringify(question)

    explainQuestion(question)

    expect(JSON.stringify(question)).toBe(snapshot)
  })
})

describe('the working shown in column and long-division steps really gives the answer', () => {
  /** The number written in one column's line: its total, or the digit brought down. */
  function columnValue(step: string): number {
    const brought = step.match(/bring down the (\d)/)
    if (brought) return Number(brought[1])
    return Number(step.match(/= (\d+)/)![1])
  }

  it('column addition: the digits written, plus the last total, rebuild the sum', () => {
    const random = seededRandom(31)
    for (let i = 0; i < 1500; i++) {
      const a = Math.floor(random() * 1001)
      const b = Math.floor(random() * 1001)
      const { method, steps } = add(a, b)
      if (method !== 'Column addition') continue

      const columns = steps.slice(0, -1)
      let rebuilt = 0
      columns.forEach((step, place) => {
        const total = columnValue(step)
        rebuilt +=
          (place === columns.length - 1 ? total : total % 10) * 10 ** place
        // A carry is only announced where there really is one, and the digit written is the units digit.
        const written = step.match(/Write (\d) and carry 1/)
        expect(Boolean(written), `${a}+${b}: ${step}`).toBe(
          total >= 10 && place < columns.length - 1,
        )
        if (written) expect(Number(written[1])).toBe(total % 10)
      })
      expect(rebuilt, `${a}+${b}`).toBe(a + b)
    }
  })

  it('column subtraction: the digits worked out rebuild the difference', () => {
    const random = seededRandom(32)
    for (let i = 0; i < 1500; i++) {
      const [a, b] = [
        Math.floor(random() * 1001),
        Math.floor(random() * 1001),
      ].sort((x, y) => y - x)
      const { method, steps } = subtract(a, b)
      if (method !== 'Column subtraction') continue

      const columns = steps.slice(0, -1)
      const rebuilt = columns.reduce((sum, step, place) => {
        const digit = step.includes('bring down')
          ? columnValue(step)
          : Number(step.match(/= (\d)/)![1])
        return sum + digit * 10 ** place
      }, 0)
      expect(rebuilt, `${a}-${b}`).toBe(a - b)
    }
  })

  it('column subtraction: a borrow is announced exactly when the digit is too small', () => {
    const random = seededRandom(33)
    for (let i = 0; i < 1500; i++) {
      const [a, b] = [
        Math.floor(random() * 1001),
        Math.floor(random() * 1001),
      ].sort((x, y) => y - x)
      const { method, steps } = subtract(a, b)
      if (method !== 'Column subtraction') continue

      const top = String(a).split('').reverse().map(Number)
      const bottom = String(b).split('').reverse().map(Number)
      let lent = 0
      steps.slice(0, -1).forEach((step, place) => {
        const needs = top[place] - lent < (bottom[place] ?? 0)
        expect(
          step.includes('borrow'),
          `${a}-${b} column ${place}: ${step}`,
        ).toBe(needs)
        lent = needs ? 1 : 0
      })
    }
  })

  it('long division: the digits that fit, in order, spell out the answer', () => {
    const random = seededRandom(34)
    for (let i = 0; i < 1500; i++) {
      const divisor = 3 + Math.floor(random() * 97)
      const quotient = Math.floor(random() * Math.floor(1000 / divisor)) + 1
      const dividend = divisor * quotient
      const { method, steps } = divide(dividend, divisor)
      if (method !== 'Long division') continue

      const digits = steps
        .slice(0, -2)
        .map((step) => {
          const fit = step.match(/fit into \d+\? (\d+),/)
          return fit ? fit[1] : '0'
        })
        .join('')
      expect(Number(digits), `${dividend}÷${divisor}`).toBe(quotient)
    }
  })

  it('long division: the first step takes just enough digits to reach the divisor', () => {
    const random = seededRandom(35)
    for (let i = 0; i < 500; i++) {
      const divisor = 3 + Math.floor(random() * 97)
      const dividend =
        divisor * (Math.floor(random() * Math.floor(1000 / divisor)) + 1)
      const { method, steps } = divide(dividend, divisor)
      if (method !== 'Long division') continue

      const chunk = Number(steps[0].match(/fit into (\d+)\?/)![1])
      expect(chunk, `${dividend}÷${divisor}`).toBeGreaterThanOrEqual(divisor)
      // One digit fewer would not have been enough.
      expect(Math.floor(chunk / 10), `${dividend}÷${divisor}`).toBeLessThan(
        divisor,
      )
      expect(String(dividend).startsWith(String(chunk))).toBe(true)
    }
  })
})
