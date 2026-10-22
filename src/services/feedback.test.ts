import { describe, expect, it, vi } from 'vitest'
import {
  PRAISE_ACCURACY,
  PRAISE_MESSAGES,
  SUPPORT_MESSAGES,
} from '../constants/feedbackMessages'
import {
  feedbackKindForResult,
  feedbackKindForSession,
  pickFeedback,
} from './feedback'

describe('feedbackKindForResult', () => {
  it('praises what the student says they got right, and supports the rest', () => {
    expect(feedbackKindForResult(true)).toBe('praise')
    expect(feedbackKindForResult(false)).toBe('support')
  })
})

describe('feedbackKindForSession', () => {
  it('praises a session from the accuracy line up, and supports one below it', () => {
    expect(feedbackKindForSession(PRAISE_ACCURACY)).toBe('praise')
    expect(feedbackKindForSession(100)).toBe('praise')
    expect(feedbackKindForSession(PRAISE_ACCURACY - 1)).toBe('support')
    expect(feedbackKindForSession(0)).toBe('support')
  })
})

describe('pickFeedback', () => {
  it.each([
    ['praise', PRAISE_MESSAGES],
    ['support', SUPPORT_MESSAGES],
  ] as const)('takes %s messages from their own list only', (kind, pool) => {
    for (let step = 0; step < 20; step++) {
      expect(pool).toContain(pickFeedback(kind, undefined, () => step / 20))
    }
  })

  it.each([
    ['praise', PRAISE_MESSAGES],
    ['support', SUPPORT_MESSAGES],
  ] as const)('can reach every %s message', (kind, pool) => {
    const seen = new Set<string>()
    for (let step = 0; step < pool.length; step++) {
      seen.add(pickFeedback(kind, undefined, () => step / pool.length))
    }

    expect([...seen].sort()).toEqual([...pool].sort())
  })

  it('never gives the message it was told came last', () => {
    for (const kind of ['praise', 'support'] as const) {
      const pool = kind === 'praise' ? PRAISE_MESSAGES : SUPPORT_MESSAGES
      for (const previous of pool) {
        for (let step = 0; step <= 20; step++) {
          expect(pickFeedback(kind, previous, () => step / 20)).not.toBe(
            previous,
          )
        }
      }
    }
  })

  it('stays inside the list for the largest number a random source can give', () => {
    const nearlyOne = 1 - Number.EPSILON
    for (const kind of ['praise', 'support'] as const) {
      expect(pickFeedback(kind, undefined, () => nearlyOne)).toBeTruthy()
      expect(pickFeedback(kind, undefined, () => 1)).toBeTruthy()
    }
  })

  it('is not bothered by a previous message from the other list', () => {
    expect(pickFeedback('praise', SUPPORT_MESSAGES[0], () => 0)).toBe(
      PRAISE_MESSAGES[0],
    )
  })

  it('uses Math.random when no source is given', () => {
    const random = vi.spyOn(Math, 'random')

    random.mockReturnValue(0)
    expect(pickFeedback('praise')).toBe(PRAISE_MESSAGES[0])
    random.mockReturnValue(0.99)
    expect(pickFeedback('praise')).toBe(PRAISE_MESSAGES.at(-1))

    random.mockRestore()
  })
})
