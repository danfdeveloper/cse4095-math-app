import { afterEach, describe, expect, it, vi } from 'vitest'
import { blockStorage, fillStorage, stored } from '../test/storage'
import {
  CURRENT_SCHEMA_VERSION,
  MIGRATIONS,
  prepareStorage,
  readSchemaVersion,
  type Migration,
} from './storageMigrations'
import { STORAGE_KEYS, writeJson } from './storageService'

let restore: (() => void) | undefined
afterEach(() => {
  restore?.()
  restore = undefined
  vi.restoreAllMocks()
})

/** Everything saved, as key -> text, however the storage is implemented. */
function snapshot(): Record<string, string | null> {
  const storage = window.localStorage
  const all: Record<string, string | null> = {}
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)!
    all[key] = storage.getItem(key)
  }
  return all
}

const setVersion = (version: unknown) =>
  window.localStorage.setItem(STORAGE_KEYS.version, JSON.stringify(version))

describe('the schema version', () => {
  it('is 1 for the first release, with no migrations to run yet', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(1)
    expect(MIGRATIONS).toEqual([])
  })
})

describe('readSchemaVersion', () => {
  it('is null when nothing is saved', () => {
    expect(readSchemaVersion()).toBeNull()
  })

  it('reads the version from { "version": n }', () => {
    setVersion({ version: 3 })

    expect(readSchemaVersion()).toBe(3)
  })

  it.each([
    ['text', 'one'],
    ['a bare number', 1],
    ['null', null],
    ['a list', [1]],
    ['a text version', { version: '1' }],
    ['a fractional version', { version: 1.5 }],
    ['a negative version', { version: -1 }],
    ['no version field', {}],
  ])('is null for %s', (_, value) => {
    setVersion(value)

    expect(readSchemaVersion()).toBeNull()
  })

  it('is null for text that is not JSON', () => {
    window.localStorage.setItem(STORAGE_KEYS.version, '{oops')

    expect(readSchemaVersion()).toBeNull()
  })
})

describe('prepareStorage on a first visit', () => {
  it('saves the current version and says it is ready', () => {
    expect(prepareStorage()).toBe('ready')

    expect(stored(STORAGE_KEYS.version)).toEqual({
      version: CURRENT_SCHEMA_VERSION,
    })
  })

  it('writes the version in the form the specification shows', () => {
    prepareStorage()

    expect(window.localStorage.getItem(STORAGE_KEYS.version)).toBe(
      '{"version":1}',
    )
  })

  it('does not create any other data', () => {
    prepareStorage()

    expect(window.localStorage.length).toBe(1)
  })
})

describe('prepareStorage when the version is already current', () => {
  it('changes nothing', () => {
    setVersion({ version: CURRENT_SCHEMA_VERSION })
    const writes = vi.spyOn(
      Object.getPrototypeOf(window.localStorage),
      'setItem',
    )

    expect(prepareStorage()).toBe('ready')

    expect(writes).not.toHaveBeenCalled()
  })
})

describe('prepareStorage with older data', () => {
  /** A chain from version 1 to 4, recording what ran and what the saved version was at each step. */
  function chain() {
    const log: string[] = []
    const migrations: Migration[] = [1, 2, 3].map((from) => ({
      from,
      to: from + 1,
      migrate: () => {
        log.push(
          `${from}->${from + 1} (saved version was ${readSchemaVersion()})`,
        )
      },
    }))
    return { log, migrations }
  }

  it('runs each migration in order up to the current version', () => {
    setVersion({ version: 1 })
    const { log, migrations } = chain()

    expect(prepareStorage(migrations, 4)).toBe('ready')

    expect(log).toEqual([
      '1->2 (saved version was 1)',
      '2->3 (saved version was 2)',
      '3->4 (saved version was 3)',
    ])
    expect(readSchemaVersion()).toBe(4)
  })

  it('starts from the saved version, skipping migrations already done', () => {
    setVersion({ version: 3 })
    const { log, migrations } = chain()

    prepareStorage(migrations, 4)

    expect(log).toEqual(['3->4 (saved version was 3)'])
  })

  it('saves the new version after every step, so a failure partway can resume', () => {
    setVersion({ version: 1 })
    const migrations: Migration[] = [
      { from: 1, to: 2, migrate: () => {} },
      {
        from: 2,
        to: 3,
        migrate: () => {
          throw new Error('step 2 failed')
        },
      },
    ]

    prepareStorage(migrations, 3)

    expect(readSchemaVersion()).toBe(2)
  })

  it('reports "unavailable" if a migration throws, and does not claim the data is current', () => {
    setVersion({ version: 1 })

    const result = prepareStorage(
      [
        {
          from: 1,
          to: 2,
          migrate: () => {
            throw new Error('boom')
          },
        },
      ],
      2,
    )

    expect(result).toBe('unavailable')
    expect(readSchemaVersion()).toBe(1)
  })

  it('lets a migration change the data it owns', () => {
    setVersion({ version: 1 })
    writeJson(STORAGE_KEYS.settings, { sound: true })

    prepareStorage(
      [
        {
          from: 1,
          to: 2,
          migrate: (storage) => {
            const old = JSON.parse(
              storage.getItem(STORAGE_KEYS.settings) ?? '{}',
            )
            storage.setItem(
              STORAGE_KEYS.settings,
              JSON.stringify({ soundEffectsEnabled: old.sound }),
            )
          },
        },
      ],
      2,
    )

    expect(stored(STORAGE_KEYS.settings)).toEqual({ soundEffectsEnabled: true })
  })

  it('leaves data that is not this app’s alone', () => {
    setVersion({ version: 1 })
    window.localStorage.setItem('someOtherApp.token', 'keep me')
    window.localStorage.setItem('theme', 'dark')

    prepareStorage([{ from: 1, to: 2, migrate: () => {} }], 2)

    expect(window.localStorage.getItem('someOtherApp.token')).toBe('keep me')
    expect(window.localStorage.getItem('theme')).toBe('dark')
  })

  it('treats saved data with no version as version 0 and migrates it', () => {
    writeJson(STORAGE_KEYS.attempts, [])
    const ran: number[] = []

    prepareStorage([{ from: 0, to: 1, migrate: () => void ran.push(0) }], 1)

    expect(ran).toEqual([0])
    expect(readSchemaVersion()).toBe(1)
  })

  it('treats an unreadable version, next to saved data, as version 0', () => {
    setVersion('garbage')
    const ran: number[] = []

    prepareStorage([{ from: 0, to: 1, migrate: () => void ran.push(0) }], 1)

    expect(ran).toEqual([0])
    expect(readSchemaVersion()).toBe(1)
  })

  it('does not run migrations on a first visit, which has nothing to migrate', () => {
    const migrate = vi.fn()

    prepareStorage([{ from: 0, to: 1, migrate }], 1)

    expect(migrate).not.toHaveBeenCalled()
    expect(readSchemaVersion()).toBe(1)
  })

  it('stops, and stamps the current version, when there is no path forward', () => {
    setVersion({ version: 1 })
    const migrate = vi.fn()

    // Only 2 -> 3 is known, so version 1 data has no way up.
    expect(prepareStorage([{ from: 2, to: 3, migrate }], 3)).toBe('ready')

    expect(migrate).not.toHaveBeenCalled()
    expect(readSchemaVersion()).toBe(3)
  })
})

describe('prepareStorage with data from a newer version', () => {
  it('says so and leaves everything exactly as it was', () => {
    setVersion({ version: 5 })
    writeJson(STORAGE_KEYS.attempts, [{ from: 'the future' }])
    window.localStorage.setItem('someOtherApp.token', 'keep me')
    const before = snapshot()

    expect(prepareStorage()).toBe('newer-version')

    expect(snapshot()).toEqual(before)
    expect(readSchemaVersion()).toBe(5)
  })

  it('does not run any migration', () => {
    setVersion({ version: 9 })
    const migrate = vi.fn()

    prepareStorage([{ from: 1, to: 2, migrate }], 2)

    expect(migrate).not.toHaveBeenCalled()
  })
})

describe('prepareStorage when storage does not work', () => {
  it('reports "unavailable" when storage is blocked', () => {
    restore = blockStorage()

    expect(prepareStorage()).toBe('unavailable')
  })

  it('reports "unavailable" when the version cannot be saved', () => {
    restore = fillStorage()

    expect(prepareStorage()).toBe('unavailable')
  })
})
