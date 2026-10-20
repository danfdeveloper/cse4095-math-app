import { describe, expect, it } from 'vitest'
import { seededRandom } from '../test/seededRandom'
import { shuffle } from './shuffle'

describe('shuffle', () => {
  it('returns the same items in some order', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8]

    expect(shuffle(items).sort((a, b) => a - b)).toEqual(items)
  })

  it('does not change the array it is given', () => {
    const items = [1, 2, 3, 4]
    const copy = [...items]

    const result = shuffle(items, seededRandom(3))

    expect(items).toEqual(copy)
    expect(result).not.toBe(items)
  })

  it('handles empty and single-item arrays', () => {
    expect(shuffle([])).toEqual([])
    expect(shuffle(['only'])).toEqual(['only'])
  })

  it('keeps duplicate values', () => {
    expect(shuffle([2, 2, 3, 3], seededRandom(9)).sort()).toEqual([2, 2, 3, 3])
  })

  it('gives the same order for the same random source', () => {
    const items = [1, 2, 3, 4, 5, 6]

    expect(shuffle(items, seededRandom(42))).toEqual(
      shuffle(items, seededRandom(42)),
    )
  })

  it('can produce every possible order of a small array', () => {
    const random = seededRandom(7)
    const orders = new Set<string>()
    for (let i = 0; i < 600; i++)
      orders.add(shuffle([1, 2, 3], random).join(''))

    expect(orders.size).toBe(6)
  })

  it('does not favor any starting position', () => {
    // Each of 4 items should land in each of 4 positions about 1000 times in 4000 shuffles.
    const random = seededRandom(2024)
    const counts = [0, 1, 2, 3].map(() => [0, 0, 0, 0])
    for (let i = 0; i < 4000; i++) {
      shuffle([0, 1, 2, 3], random).forEach((item, position) => {
        counts[item][position]++
      })
    }

    for (const row of counts) {
      for (const count of row) {
        expect(count).toBeGreaterThan(850)
        expect(count).toBeLessThan(1150)
      }
    }
  })
})
