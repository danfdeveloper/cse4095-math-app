import { describe, expect, it } from 'vitest'
import { evaluate, findEquations, wrongEquations } from './equations'

describe('the equation checker the explanation tests rely on', () => {
  it('finds equations inside sentences', () => {
    expect(findEquations('Ones: 7 + 8 = 15. Write 5 and carry 1.')).toEqual([
      '7 + 8 = 15',
    ])
    expect(findEquations('5 × 8 = 40, and 2 × 8 = 16.')).toEqual([
      '5 × 8 = 40',
      '2 × 8 = 16',
    ])
    expect(
      findEquations('Tens: 4 + 3 + 1 = 8 (the extra 1 was carried).'),
    ).toEqual(['4 + 3 + 1 = 8'])
  })

  it('finds nothing in text without an equation', () => {
    expect(findEquations('Adding 0 does not change a number.')).toEqual([])
    expect(findEquations('Start at 8 and count on 7: 9, 10, 11.')).toEqual([])
  })

  it('evaluates with the usual order of operations', () => {
    expect(evaluate('2 + 3 × 4')).toBe(14)
    expect(evaluate('10 − 6 ÷ 2')).toBe(7)
    expect(evaluate('10 − 1 − 2')).toBe(7)
    expect(evaluate('7 + 7 + 7')).toBe(21)
    expect(evaluate('80 ÷ 2')).toBe(40)
  })

  it('recognises a true equation as true', () => {
    expect(wrongEquations('7 × 8 = 56 and 40 + 16 = 56')).toEqual([])
  })

  it('catches a false equation, so the checks built on it can fail', () => {
    expect(wrongEquations('7 × 8 = 54')).toEqual(['7 × 8 = 54'])
    expect(wrongEquations('4 + 3 + 1 = 9')).toEqual(['4 + 3 + 1 = 9'])
    expect(wrongEquations('10 − 1 − 2 = 6')).toEqual(['10 − 1 − 2 = 6'])
  })
})
