import { describe, expect, it } from 'vitest'
import { makeSession } from '../test/fixtures'
import { limitSessions, removeSession, upsertSession } from './sessionHistory'

const sessionsNumbered = (count: number) =>
  Array.from({ length: count }, (_, i) => makeSession({ id: `s${i + 1}` }))

describe('limitSessions', () => {
  it('keeps everything when under the limit', () => {
    expect(limitSessions(sessionsNumbered(3), 5).map((s) => s.id)).toEqual([
      's1',
      's2',
      's3',
    ])
  })

  it('keeps everything when exactly at the limit', () => {
    expect(limitSessions(sessionsNumbered(5), 5)).toHaveLength(5)
  })

  it('drops the oldest sessions first', () => {
    expect(limitSessions(sessionsNumbered(8), 5).map((s) => s.id)).toEqual([
      's4',
      's5',
      's6',
      's7',
      's8',
    ])
  })

  it('keeps the 100 most recent by default', () => {
    const limited = limitSessions(sessionsNumbered(130))

    expect(limited).toHaveLength(100)
    expect(limited[0].id).toBe('s31')
    expect(limited[99].id).toBe('s130')
  })

  it('does not change the list it was given', () => {
    const all = sessionsNumbered(8)

    limitSessions(all, 5)

    expect(all).toHaveLength(8)
  })

  it('handles an empty list', () => {
    expect(limitSessions([])).toEqual([])
  })
})

describe('upsertSession', () => {
  it('adds a new session at the end', () => {
    const result = upsertSession(
      sessionsNumbered(2),
      makeSession({ id: 'new' }),
    )

    expect(result.map((s) => s.id)).toEqual(['s1', 's2', 'new'])
  })

  it('replaces a saved session in place, keeping its position', () => {
    const result = upsertSession(
      sessionsNumbered(3),
      makeSession({ id: 's2', attempted: 9, correct: 9, incorrect: 0 }),
    )

    expect(result.map((s) => s.id)).toEqual(['s1', 's2', 's3'])
    expect(result[1].attempted).toBe(9)
  })

  it('does not change the list it was given', () => {
    const all = sessionsNumbered(2)

    upsertSession(
      all,
      makeSession({ id: 's1', attempted: 9, correct: 9, incorrect: 0 }),
    )
    upsertSession(all, makeSession({ id: 'new' }))

    expect(all.map((s) => s.attempted)).toEqual([5, 5])
    expect(all).toHaveLength(2)
  })

  it('drops the oldest when adding goes over the limit', () => {
    const result = upsertSession(
      sessionsNumbered(100),
      makeSession({ id: 'new' }),
    )

    expect(result).toHaveLength(100)
    expect(result[0].id).toBe('s2')
    expect(result[99].id).toBe('new')
  })

  it('does not drop anything when replacing at the limit', () => {
    const result = upsertSession(
      sessionsNumbered(100),
      makeSession({ id: 's50', attempted: 7, correct: 7, incorrect: 0 }),
    )

    expect(result).toHaveLength(100)
    expect(result[0].id).toBe('s1')
  })
})

describe('removeSession', () => {
  it('removes just that session', () => {
    expect(removeSession(sessionsNumbered(3), 's2').map((s) => s.id)).toEqual([
      's1',
      's3',
    ])
  })

  it('does nothing for an unknown id', () => {
    expect(removeSession(sessionsNumbered(3), 'nope')).toHaveLength(3)
  })
})
