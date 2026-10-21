import type { MathOperation, Question } from '../types/question'

/**
 * Explains an answer by naming the method that solves that kind of problem and
 * walking through it. The same kind of problem always gets the same method, so
 * a child learns to connect a problem with how to solve it. Every number is
 * worked out from the question itself.
 */
export interface Explanation {
  /** The name of the method, such as "Making a ten". */
  method: string
  /** Short steps in order. The last one always states the whole answer. */
  steps: string[]
}

type ExplainableQuestion = Pick<
  Question,
  | 'operation'
  | 'firstOperand'
  | 'secondOperand'
  | 'correctAnswer'
  | 'displayText'
>

/** Every method name that can be given, by operation. */
export const EXPLANATION_METHODS = {
  addition: [
    'Adding zero',
    'Doubles',
    'Counting on',
    'Adding ten',
    'Making a ten',
    'Adding whole tens',
    'Column addition',
  ],
  subtraction: [
    'Subtracting zero',
    'Taking away the same number',
    'Counting back',
    'Thinking addition',
    'Column subtraction',
  ],
  multiplication: [
    'Times zero',
    'Times one',
    'Times ten',
    'Doubling',
    'Half of ten groups',
    'Ten groups minus one',
    'Repeated addition',
    'Splitting with fives',
    'Multiplying with zeros',
    'Splitting into tens and ones',
  ],
  division: [
    'Dividing zero',
    'Dividing by one',
    'Dividing a number by itself',
    'Dividing by ten',
    'Halving',
    'Thinking multiplication',
    'Long division',
  ],
} as const satisfies Record<MathOperation, readonly string[]>

/** Used when a question does not add up, so nothing wrong is ever taught. */
export const FALLBACK_METHOD = 'Working it out'

interface Method {
  method: string
  steps: string[]
}

const COLUMN_NAMES = ['Ones', 'Tens', 'Hundreds', 'Thousands', 'Ten thousands']
const NEXT_UNIT = [
  'ten',
  'hundred',
  'thousand',
  'ten thousand',
  'hundred thousand',
]

/** The digits of a number, starting from the ones place. */
function digitsOf(n: number): number[] {
  return String(n).split('').reverse().map(Number)
}

function columnName(index: number): string {
  return COLUMN_NAMES[index] ?? `Column ${index + 1}`
}

function nextUnit(index: number): string {
  return NEXT_UNIT[index] ?? 'unit'
}

function trailingZeros(n: number): number {
  let count = 0
  while (n > 0 && n % 10 === 0) {
    count++
    n /= 10
  }
  return count
}

/* ---------------------------------- Addition ---------------------------------- */

function columnAddition(a: number, b: number): string[] {
  const top = digitsOf(a)
  const bottom = digitsOf(b)
  const columns = Math.max(top.length, bottom.length)
  const steps: string[] = []
  let carry = 0

  for (let i = 0; i < columns; i++) {
    const terms = [top[i], bottom[i]].filter(
      (digit): digit is number => digit !== undefined,
    )
    if (carry > 0) terms.push(carry)
    const total = terms.reduce((sum, term) => sum + term, 0)

    if (terms.length === 1) {
      steps.push(`${columnName(i)}: bring down the ${terms[0]}.`)
    } else {
      let line = `${columnName(i)}: ${terms.join(' + ')} = ${total}`
      if (carry > 0) line += ' (the extra 1 was carried)'
      line += '.'
      // The last column has nowhere further to carry to; its total is written out in full.
      if (total >= 10 && i < columns - 1) {
        line += ` Write ${total % 10} and carry 1.`
      }
      steps.push(line)
    }
    carry = total >= 10 ? 1 : 0
  }
  return steps
}

function explainAddition(a: number, b: number, sum: number): Method {
  if (a === 0 || b === 0) {
    return {
      method: 'Adding zero',
      steps: ['Adding 0 does not change a number.'],
    }
  }

  if (a === b && a <= 10) {
    return {
      method: 'Doubles',
      steps: [
        `Both numbers are ${a}, so this is a double: the same number twice.`,
      ],
    }
  }

  if (a <= 10 && b <= 10) {
    const big = Math.max(a, b)
    const small = Math.min(a, b)

    if (sum <= 10) {
      const counted = Array.from({ length: small }, (_, i) => big + i + 1)
      return {
        method: 'Counting on',
        steps: [
          `Start at ${big} and count on ${small}: ${counted.join(', ')}.`,
        ],
      }
    }
    if (big === 10) {
      return {
        method: 'Adding ten',
        steps: [
          `Ten and ${small} more: the 1 ten stays, and ${small} goes in the ones place.`,
        ],
      }
    }
    const need = 10 - big
    const left = small - need
    return {
      method: 'Making a ten',
      steps: [
        `${big} needs ${need} more to make 10.`,
        `Take ${need} from ${small}, which leaves ${small} − ${need} = ${left}.`,
        `10 + ${left} = ${sum}.`,
      ],
    }
  }

  if (a % 10 === 0 && b % 10 === 0 && a < 100 && b < 100) {
    return {
      method: 'Adding whole tens',
      steps: [
        'Both numbers are whole tens, so add the tens digits.',
        `${a / 10} + ${b / 10} = ${sum / 10}, and ${sum / 10} tens is ${sum}.`,
      ],
    }
  }

  return { method: 'Column addition', steps: columnAddition(a, b) }
}

/* --------------------------------- Subtraction -------------------------------- */

function columnSubtraction(a: number, b: number): string[] {
  const top = digitsOf(a)
  const bottom = digitsOf(b)
  const steps: string[] = []
  let lent = 0 // 1 when the column to the right borrowed from this one

  for (let i = 0; i < top.length; i++) {
    const digit = top[i]
    const taking: number | undefined = bottom[i]
    const needsBorrow = digit - lent < (taking ?? 0)
    const available = needsBorrow ? digit + 10 : digit

    const parts = [available]
    if (lent > 0) parts.push(lent)
    if (taking !== undefined) parts.push(taking)
    const result =
      parts[0] - parts.slice(1).reduce((sum, part) => sum + part, 0)

    if (parts.length === 1) {
      steps.push(`${columnName(i)}: bring down the ${digit}.`)
    } else if (needsBorrow) {
      const reason = lent > 0 ? ' after the 1 that was lent' : ''
      steps.push(
        `${columnName(i)}: ${digit} is too small${reason}, so borrow 1 ${nextUnit(i)}. ${parts.join(' − ')} = ${result}.`,
      )
    } else {
      const note =
        lent > 0 ? ' (the 1 was lent to the column on the right)' : ''
      steps.push(`${columnName(i)}: ${parts.join(' − ')} = ${result}${note}.`)
    }
    lent = needsBorrow ? 1 : 0
  }
  return steps
}

function explainSubtraction(a: number, b: number, difference: number): Method {
  if (b === 0) {
    return {
      method: 'Subtracting zero',
      steps: ['Taking away 0 leaves the number as it is.'],
    }
  }
  if (a === b) {
    return {
      method: 'Taking away the same number',
      steps: ['Taking a number away from itself leaves nothing.'],
    }
  }

  if (a <= 10) {
    if (b <= 3) {
      const counted = Array.from({ length: b }, (_, i) => a - i - 1)
      return {
        method: 'Counting back',
        steps: [`Start at ${a} and count back ${b}: ${counted.join(', ')}.`],
      }
    }
    return {
      method: 'Thinking addition',
      steps: [
        `Think: what do you add to ${b} to make ${a}?`,
        `${b} + ${difference} = ${a}.`,
      ],
    }
  }

  return { method: 'Column subtraction', steps: columnSubtraction(a, b) }
}

/* ------------------------------- Multiplication ------------------------------- */

function explainMultiplication(a: number, b: number, product: number): Method {
  if (a === 0 || b === 0) {
    return {
      method: 'Times zero',
      steps: ['Zero groups, or groups with nothing in them, always make 0.'],
    }
  }
  if (a === 1 || b === 1) {
    return {
      method: 'Times one',
      steps: ['One group of a number is just that number.'],
    }
  }
  if (a === 10 || b === 10) {
    const other = a === 10 ? b : a
    return {
      method: 'Times ten',
      steps: [`To multiply by 10, put a 0 on the end of ${other}.`],
    }
  }

  if (a <= 10 && b <= 10) {
    const small = Math.min(a, b)
    const large = Math.max(a, b)

    if (a === 2 || b === 2) {
      const other = a === 2 ? b : a
      return {
        method: 'Doubling',
        steps: [
          `Times 2 is the same as doubling: ${other} + ${other} = ${product}.`,
        ],
      }
    }
    if (a === 5 || b === 5) {
      const other = a === 5 ? b : a
      return {
        method: 'Half of ten groups',
        steps: [
          'Five is half of ten, so find 10 groups and take half.',
          `10 × ${other} = ${10 * other}, and ${10 * other} ÷ 2 = ${product}.`,
        ],
      }
    }
    if (a === 9 || b === 9) {
      const other = a === 9 ? b : a
      return {
        method: 'Ten groups minus one',
        steps: [
          'Nine is one less than ten, so find 10 groups and take one group away.',
          `10 × ${other} = ${10 * other}, and ${10 * other} − ${other} = ${product}.`,
        ],
      }
    }
    if (small <= 4) {
      const added = Array(small).fill(large).join(' + ')
      return {
        method: 'Repeated addition',
        steps: [
          `${small} groups of ${large} is ${large} added ${small} times.`,
          `${added} = ${product}.`,
        ],
      }
    }
    // Both are 6, 7 or 8: split the smaller into 5 and the rest, both easy facts.
    const rest = small - 5
    return {
      method: 'Splitting with fives',
      steps: [
        `Split ${small} into 5 and ${rest}.`,
        `5 × ${large} = ${5 * large}, and ${rest} × ${large} = ${rest * large}.`,
        `${5 * large} + ${rest * large} = ${product}.`,
      ],
    }
  }

  const zeros = trailingZeros(a) + trailingZeros(b)
  if (zeros > 0) {
    const stripA = a / 10 ** trailingZeros(a)
    const stripB = b / 10 ** trailingZeros(b)
    const noun = zeros === 1 ? 'the zero' : `the ${zeros} zeros`
    return {
      method: 'Multiplying with zeros',
      steps: [
        `Leave out the ${zeros === 1 ? 'zero' : 'zeros'} for now: ${stripA} × ${stripB} = ${stripA * stripB}.`,
        `Put ${noun} back on the end: ${product}.`,
      ],
    }
  }

  // Split a two-digit factor into tens and ones, and multiply each part.
  const splitSecond = b >= 10
  const split = splitSecond ? b : a
  const ones = split % 10
  const tens = split - ones
  const first = splitSecond ? a * tens : tens * b
  const second = splitSecond ? a * ones : ones * b
  const pieces = splitSecond
    ? [`${a} × ${tens} = ${first}`, `${a} × ${ones} = ${second}`]
    : [`${tens} × ${b} = ${first}`, `${ones} × ${b} = ${second}`]
  return {
    method: 'Splitting into tens and ones',
    steps: [
      `Split ${split} into ${tens} and ${ones}.`,
      `${pieces[0]}, and ${pieces[1]}.`,
      `${first} + ${second} = ${product}.`,
    ],
  }
}

/* ----------------------------------- Division ---------------------------------- */

function longDivision(dividend: number, divisor: number): string[] {
  const digits = String(dividend).split('').map(Number)
  const steps: string[] = []

  // Start with as many digits as it takes to reach the divisor.
  let used = 0
  let chunk = 0
  while (used < digits.length && chunk < divisor) {
    chunk = chunk * 10 + digits[used]
    used++
  }

  let bringDown: number | null = null
  for (;;) {
    const fits = Math.floor(chunk / divisor)
    const product = fits * divisor
    const left = chunk - product

    let line =
      bringDown === null
        ? ''
        : `Bring down the ${bringDown}: that makes ${chunk}. `
    line +=
      fits === 0
        ? `${divisor} does not fit into ${chunk}, so write 0.`
        : `How many ${divisor}s fit into ${chunk}? ${fits}, because ${fits} × ${divisor} = ${product}.`
    line +=
      left > 0
        ? ` Subtract: ${chunk} − ${product} = ${left}.`
        : ' Nothing is left over.'
    steps.push(line)

    if (used >= digits.length) break
    bringDown = digits[used]
    used++
    chunk = left * 10 + bringDown
  }
  return steps
}

function explainDivision(
  dividend: number,
  divisor: number,
  quotient: number,
): Method {
  if (dividend === 0) {
    return {
      method: 'Dividing zero',
      steps: ['There is nothing to share, so every group gets 0.'],
    }
  }
  if (divisor === 1) {
    return {
      method: 'Dividing by one',
      steps: ['Dividing by 1 leaves the number as it is.'],
    }
  }
  if (dividend === divisor) {
    return {
      method: 'Dividing a number by itself',
      steps: ['A number divided by itself is always 1.'],
    }
  }
  if (divisor === 10) {
    return {
      method: 'Dividing by ten',
      steps: [`To divide by 10, take a 0 off the end of ${dividend}.`],
    }
  }
  if (divisor === 2) {
    return {
      method: 'Halving',
      steps: [
        'Dividing by 2 means finding half.',
        `${quotient} + ${quotient} = ${dividend}, so half of ${dividend} is ${quotient}.`,
      ],
    }
  }
  if (divisor <= 12 && quotient <= 12) {
    return {
      method: 'Thinking multiplication',
      steps: [
        `Division undoes multiplication. Ask: ${divisor} times what makes ${dividend}?`,
        `${divisor} × ${quotient} = ${dividend}.`,
      ],
    }
  }
  return {
    method: 'Long division',
    steps: [
      ...longDivision(dividend, divisor),
      `Check by multiplying: ${quotient} × ${divisor} = ${dividend}.`,
    ],
  }
}

/* ---------------------------------- The entry point --------------------------- */

function isWholeNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 0
}

/** Whether the question is a true sum, so that explaining it cannot teach something wrong. */
function isConsistent({
  operation,
  firstOperand: a,
  secondOperand: b,
  correctAnswer: answer,
}: ExplainableQuestion): boolean {
  if (![a, b, answer].every(isWholeNumber)) return false
  switch (operation) {
    case 'addition':
      return a + b === answer
    case 'subtraction':
      return a >= b && a - b === answer
    case 'multiplication':
      return a * b === answer
    case 'division':
      return b > 0 && a === b * answer
    default:
      return false
  }
}

/**
 * How to solve the question: the method's name and its steps, ending with the
 * whole answer. A question that does not add up gets only a plain statement.
 */
export function explainQuestion(question: ExplainableQuestion): Explanation {
  const conclusion = `So ${question.displayText} = ${question.correctAnswer}.`
  if (!isConsistent(question)) {
    return { method: FALLBACK_METHOD, steps: [conclusion] }
  }

  const { firstOperand: a, secondOperand: b, correctAnswer: answer } = question
  let chosen: Method
  switch (question.operation) {
    case 'addition':
      chosen = explainAddition(a, b, answer)
      break
    case 'subtraction':
      chosen = explainSubtraction(a, b, answer)
      break
    case 'multiplication':
      chosen = explainMultiplication(a, b, answer)
      break
    case 'division':
      chosen = explainDivision(a, b, answer)
      break
    default:
      return { method: FALLBACK_METHOD, steps: [conclusion] }
  }
  return { method: chosen.method, steps: [...chosen.steps, conclusion] }
}
