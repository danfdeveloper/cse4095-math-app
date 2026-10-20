import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateId } from './ids'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('generateId', () => {
  it('returns a non-empty string', () => {
    const id = generateId()

    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('returns a different ID every time', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 10_000; i++) ids.add(generateId())

    expect(ids.size).toBe(10_000)
  })

  it('still works where crypto.randomUUID is unavailable (plain http)', () => {
    vi.stubGlobal('crypto', {})

    const ids = new Set<string>()
    for (let i = 0; i < 10_000; i++) ids.add(generateId())

    expect(ids.size).toBe(10_000)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/)
  })

  it('still works where crypto is missing entirely', () => {
    vi.stubGlobal('crypto', undefined)

    expect(generateId()).not.toBe(generateId())
  })
})
