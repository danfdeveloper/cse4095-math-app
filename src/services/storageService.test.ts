import { afterEach, describe, expect, it } from 'vitest'
import { blockStorage, breakStorageMethod, fillStorage } from '../test/storage'
import {
  clearAppData,
  getStorage,
  listAppKeys,
  readJson,
  readRawJson,
  removeKeys,
  STORAGE_KEYS,
  writeJson,
} from './storageService'

const isNumberList = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'number')

let restore: (() => void) | undefined
afterEach(() => {
  restore?.()
  restore = undefined
})

describe('storage keys', () => {
  it('are the ones named in the specification, and one more for the session in progress', () => {
    expect(STORAGE_KEYS).toEqual({
      settings: 'mathPractice.settings',
      sessions: 'mathPractice.sessions',
      attempts: 'mathPractice.attempts',
      mistakePatterns: 'mathPractice.mistakePatterns',
      statistics: 'mathPractice.statistics',
      version: 'mathPractice.version',
      activeSession: 'mathPractice.activeSession',
    })
  })
})

describe('getStorage', () => {
  it('returns the browser storage', () => {
    expect(getStorage()).toBe(window.localStorage)
  })

  it('returns null, instead of throwing, when storage is blocked', () => {
    restore = blockStorage()

    expect(getStorage()).toBeNull()
  })
})

describe('writeJson and readJson', () => {
  it('save and read back a value', () => {
    expect(writeJson(STORAGE_KEYS.attempts, [1, 2, 3])).toEqual({ ok: true })

    expect(readJson(STORAGE_KEYS.attempts, isNumberList)).toEqual({
      status: 'ok',
      value: [1, 2, 3],
    })
  })

  it('store the value as JSON text', () => {
    writeJson(STORAGE_KEYS.version, { version: 1 })

    expect(window.localStorage.getItem(STORAGE_KEYS.version)).toBe(
      '{"version":1}',
    )
  })

  it('round-trip objects with nested data', () => {
    const value = { a: [1, { b: 'two' }], c: null, d: true }
    writeJson(STORAGE_KEYS.settings, value)

    expect(readRawJson(STORAGE_KEYS.settings)).toEqual({ status: 'ok', value })
  })

  it('report a key that was never saved as missing', () => {
    expect(readJson(STORAGE_KEYS.attempts, isNumberList)).toEqual({
      status: 'missing',
    })
  })

  describe('reading data that is not usable', () => {
    it('reports text that is not valid JSON as invalid', () => {
      window.localStorage.setItem(STORAGE_KEYS.attempts, '{not json')

      expect(readJson(STORAGE_KEYS.attempts, isNumberList)).toEqual({
        status: 'invalid',
        reason: 'not valid JSON',
      })
    })

    it('reports truncated JSON as invalid', () => {
      window.localStorage.setItem(STORAGE_KEYS.attempts, '[1, 2, ')

      expect(readJson(STORAGE_KEYS.attempts, isNumberList).status).toBe(
        'invalid',
      )
    })

    it('reports JSON of the wrong shape as invalid', () => {
      window.localStorage.setItem(STORAGE_KEYS.attempts, '{"not":"a list"}')

      expect(readJson(STORAGE_KEYS.attempts, isNumberList)).toEqual({
        status: 'invalid',
        reason: 'unexpected shape',
      })
    })

    it('reports a list with the wrong kind of items as invalid', () => {
      window.localStorage.setItem(STORAGE_KEYS.attempts, '[1, "two"]')

      expect(readJson(STORAGE_KEYS.attempts, isNumberList).status).toBe(
        'invalid',
      )
    })

    it('does not change what is saved when it finds bad data', () => {
      window.localStorage.setItem(STORAGE_KEYS.attempts, '{not json')

      readJson(STORAGE_KEYS.attempts, isNumberList)

      expect(window.localStorage.getItem(STORAGE_KEYS.attempts)).toBe(
        '{not json',
      )
    })

    it('accepts a stored null as a real value for readRawJson', () => {
      window.localStorage.setItem(STORAGE_KEYS.settings, 'null')

      expect(readRawJson(STORAGE_KEYS.settings)).toEqual({
        status: 'ok',
        value: null,
      })
    })
  })

  describe('when storage is blocked', () => {
    it('reads report "unavailable" and do not throw', () => {
      restore = blockStorage()

      expect(readJson(STORAGE_KEYS.attempts, isNumberList)).toEqual({
        status: 'unavailable',
      })
      expect(readRawJson(STORAGE_KEYS.settings)).toEqual({
        status: 'unavailable',
      })
    })

    it('writes report "unavailable" and do not throw', () => {
      restore = blockStorage()

      expect(writeJson(STORAGE_KEYS.attempts, [1])).toEqual({
        ok: false,
        reason: 'unavailable',
      })
    })
  })

  describe('when a storage call fails', () => {
    it('reads report "unavailable" if getItem throws', () => {
      restore = breakStorageMethod('getItem')

      expect(readJson(STORAGE_KEYS.attempts, isNumberList)).toEqual({
        status: 'unavailable',
      })
    })

    it('writes report "unavailable" if setItem fails for an unknown reason', () => {
      restore = breakStorageMethod('setItem')

      expect(writeJson(STORAGE_KEYS.attempts, [1])).toEqual({
        ok: false,
        reason: 'unavailable',
      })
    })

    it('writes report "unavailable" for a value JSON cannot represent', () => {
      const circular: Record<string, unknown> = {}
      circular.self = circular

      expect(writeJson(STORAGE_KEYS.attempts, circular)).toEqual({
        ok: false,
        reason: 'unavailable',
      })
    })
  })

  describe('when storage is full', () => {
    it.each([
      [
        'QuotaExceededError (most browsers)',
        new DOMException('full', 'QuotaExceededError'),
      ],
      [
        'NS_ERROR_DOM_QUOTA_REACHED (older Firefox)',
        new DOMException('full', 'NS_ERROR_DOM_QUOTA_REACHED'),
      ],
    ])('writes report "full" for %s', (_, error) => {
      restore = fillStorage(error)

      expect(writeJson(STORAGE_KEYS.attempts, [1])).toEqual({
        ok: false,
        reason: 'full',
      })
    })

    it('recognises the numeric quota error codes', () => {
      const legacy = new DOMException('full', 'SomethingElse')
      Object.defineProperty(legacy, 'code', { value: 22 })
      restore = fillStorage(legacy)

      expect(writeJson(STORAGE_KEYS.attempts, [1])).toEqual({
        ok: false,
        reason: 'full',
      })
    })

    it('does not treat an unrelated error as "full"', () => {
      restore = fillStorage(new DOMException('nope', 'SecurityError'))

      expect(writeJson(STORAGE_KEYS.attempts, [1])).toEqual({
        ok: false,
        reason: 'unavailable',
      })
    })

    it('still lets saved data be read', () => {
      writeJson(STORAGE_KEYS.attempts, [1, 2])
      restore = fillStorage()

      expect(readJson(STORAGE_KEYS.attempts, isNumberList)).toEqual({
        status: 'ok',
        value: [1, 2],
      })
    })
  })
})

describe('removeKeys', () => {
  it('removes only the keys it is given', () => {
    writeJson(STORAGE_KEYS.attempts, [1])
    writeJson(STORAGE_KEYS.sessions, [2])
    writeJson(STORAGE_KEYS.settings, {})

    expect(removeKeys([STORAGE_KEYS.attempts, STORAGE_KEYS.sessions])).toBe(
      true,
    )

    expect(window.localStorage.getItem(STORAGE_KEYS.attempts)).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEYS.sessions)).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEYS.settings)).not.toBeNull()
  })

  it('is fine with keys that are not there', () => {
    expect(removeKeys([STORAGE_KEYS.attempts])).toBe(true)
  })

  it('returns false, instead of throwing, when storage is blocked', () => {
    restore = blockStorage()

    expect(removeKeys([STORAGE_KEYS.attempts])).toBe(false)
  })

  it('returns false if removal fails', () => {
    restore = breakStorageMethod('removeItem')

    expect(removeKeys([STORAGE_KEYS.attempts])).toBe(false)
  })
})

describe('listAppKeys and clearAppData', () => {
  function saveSomeAppAndOtherData() {
    writeJson(STORAGE_KEYS.attempts, [1])
    writeJson(STORAGE_KEYS.settings, {})
    writeJson(STORAGE_KEYS.version, { version: 1 })
    window.localStorage.setItem('someOtherApp.token', 'keep me')
    window.localStorage.setItem('theme', 'dark')
  }

  it('list only keys this app saved', () => {
    saveSomeAppAndOtherData()

    expect(listAppKeys().sort()).toEqual([
      STORAGE_KEYS.attempts,
      STORAGE_KEYS.settings,
      STORAGE_KEYS.version,
    ])
  })

  it('clear all of this app’s data, including the version', () => {
    saveSomeAppAndOtherData()

    expect(clearAppData()).toBe(true)

    expect(listAppKeys()).toEqual([])
  })

  it('leave data that belongs to anything else on the same site alone', () => {
    saveSomeAppAndOtherData()

    clearAppData()

    expect(window.localStorage.getItem('someOtherApp.token')).toBe('keep me')
    expect(window.localStorage.getItem('theme')).toBe('dark')
  })

  it('do not match keys that merely look similar', () => {
    window.localStorage.setItem('mathPracticeExtra', 'x')
    window.localStorage.setItem('xmathPractice.settings', 'x')

    expect(listAppKeys()).toEqual([])
  })

  it('return an empty list, and false, when storage is blocked', () => {
    restore = blockStorage()

    expect(listAppKeys()).toEqual([])
    expect(clearAppData()).toBe(false)
  })

  it('cope with storage failing partway', () => {
    saveSomeAppAndOtherData()
    restore = breakStorageMethod('removeItem')

    expect(clearAppData()).toBe(false)
  })
})
