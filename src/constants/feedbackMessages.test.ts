import { describe, expect, it } from 'vitest'
import { PRAISE_MESSAGES, SUPPORT_MESSAGES } from './feedbackMessages'

const ALL = [
  ...PRAISE_MESSAGES.map((message) => ['praise', message] as const),
  ...SUPPORT_MESSAGES.map((message) => ['support', message] as const),
]

/** Words that tell a child they were wrong or did badly (specification section 13.4). */
const SHAMING =
  /\b(wrong|incorrect|fail(ed|ure|s)?|bad(ly)?|stupid|dumb|silly|terrible|worse|worst|lazy|careless|disappoint\w*|no\b|not|never|can'?t|won'?t|don'?t|didn'?t|mistake(s)? (are|were)|try again|too)\b/i

describe('the feedback messages', () => {
  it('are plentiful enough to change from one question to the next', () => {
    expect(PRAISE_MESSAGES.length).toBeGreaterThanOrEqual(5)
    expect(SUPPORT_MESSAGES.length).toBeGreaterThanOrEqual(5)
  })

  it.each(ALL)('(%s) "%s" does not shame or discourage', (_kind, message) => {
    expect(message).not.toMatch(SHAMING)
  })

  it.each(ALL)(
    '(%s) "%s" is short, plain text that ends like a sentence',
    (_kind, message) => {
      expect(message.length).toBeLessThanOrEqual(26)
      expect(message).toMatch(/^[A-Z][A-Za-z ]+[.!]$/)
    },
  )

  it('are all different, and shared between neither list', () => {
    const messages = ALL.map(([, message]) => message)

    expect(new Set(messages).size).toBe(messages.length)
  })

  it('has encouragement after a mistake that looks forward, to learning or the next try', () => {
    for (const message of SUPPORT_MESSAGES) {
      expect(message).toMatch(
        /practic|try|learn|grow|can do|get it|effort|next time/i,
      )
    }
  })

  it('does not celebrate beyond a cheer, with no more than one exclamation mark each', () => {
    for (const [, message] of ALL) {
      expect(message.split('!').length - 1).toBeLessThanOrEqual(1)
    }
  })
})
