import { describe, expect, it } from 'vitest'
import { ALMOST_ONE, seededRandom, sequenceRandom } from '../test/seededRandom'
import { calculateAnswer, isInRange, randomInt } from './math'

describe('randomInt', () => {
  it('always returns a whole number within the inclusive range', () => {
    for (let i = 0; i < 2000; i++) {
      const value = randomInt(3, 9)
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(3)
      expect(value).toBeLessThanOrEqual(9)
    }
  })

  it('can return both the minimum and the maximum', () => {
    expect(randomInt(3, 9, () => 0)).toBe(3)
    expect(randomInt(3, 9, () => ALMOST_ONE)).toBe(9)
  })

  it('eventually produces every value in a small range', () => {
    const random = seededRandom(1)
    const seen = new Set<number>()
    for (let i = 0; i < 500; i++) seen.add(randomInt(0, 5, random))

    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('returns the only possible value when min equals max', () => {
    expect(randomInt(7, 7)).toBe(7)
  })

  it('supports ranges that include negative numbers', () => {
    expect(randomInt(-5, -1, () => 0)).toBe(-5)
    expect(randomInt(-5, -1, () => ALMOST_ONE)).toBe(-1)
    expect(randomInt(-2, 2, () => 0.5)).toBe(0)
  })

  it('rejects an inverted range', () => {
    expect(() => randomInt(5, 4)).toThrow(RangeError)
  })

  it.each([
    [1.5, 4],
    [1, 4.5],
    [Number.NaN, 4],
    [1, Number.POSITIVE_INFINITY],
  ])('rejects non-whole bounds (%s, %s)', (min, max) => {
    expect(() => randomInt(min, max)).toThrow(RangeError)
  })

  it('uses the random source it is given', () => {
    const random = sequenceRandom([0, 0.5, ALMOST_ONE])

    expect([
      randomInt(0, 9, random),
      randomInt(0, 9, random),
      randomInt(0, 9, random),
    ]).toEqual([0, 5, 9])
  })
})

describe('isInRange', () => {
  it('includes both ends and excludes values outside', () => {
    const range = { min: 2, max: 5 }

    expect(isInRange(2, range)).toBe(true)
    expect(isInRange(5, range)).toBe(true)
    expect(isInRange(1, range)).toBe(false)
    expect(isInRange(6, range)).toBe(false)
  })
})

describe('calculateAnswer', () => {
  it('adds, subtracts, multiplies and divides', () => {
    expect(calculateAnswer('addition', 8, 7)).toBe(15)
    expect(calculateAnswer('subtraction', 8, 7)).toBe(1)
    expect(calculateAnswer('multiplication', 8, 7)).toBe(56)
    expect(calculateAnswer('division', 56, 7)).toBe(8)
  })

  it('returns a fraction for a division that does not come out even', () => {
    expect(calculateAnswer('division', 7, 2)).toBe(3.5)
  })

  it('handles zero operands', () => {
    expect(calculateAnswer('multiplication', 0, 9)).toBe(0)
    expect(calculateAnswer('division', 0, 9)).toBe(0)
    expect(calculateAnswer('subtraction', 4, 4)).toBe(0)
  })

  it('rejects an unsupported operation', () => {
    expect(() => calculateAnswer('power' as never, 2, 3)).toThrow(
      /unsupported operation/i,
    )
  })
})
