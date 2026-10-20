import {
  getStorage,
  listAppKeys,
  readJson,
  STORAGE_KEYS,
  writeJson,
} from './storageService'

/**
 * The version of the saved-data layout. Raise it, and add a Migration below,
 * whenever the shape of what is saved changes.
 */
export const CURRENT_SCHEMA_VERSION = 1

/** Brings saved data from one version to the next. */
export interface Migration {
  from: number
  to: number
  migrate: (storage: Storage) => void
}

/** Version 1 is the first layout, so there is nothing to migrate from yet. */
export const MIGRATIONS: readonly Migration[] = []

export type StoragePreparation =
  /** Saved data is at the current version and safe to use. */
  | 'ready'
  /** The browser's storage cannot be used. */
  | 'unavailable'
  /** The data was saved by a newer version of the app, so it is left untouched. */
  | 'newer-version'

interface StoredVersion {
  version: number
}

function isStoredVersion(value: unknown): value is StoredVersion {
  return (
    typeof value === 'object' &&
    value !== null &&
    Number.isInteger((value as StoredVersion).version) &&
    (value as StoredVersion).version >= 0
  )
}

/** The saved version, or null if there is none or it is unreadable. */
export function readSchemaVersion(): number | null {
  const result = readJson(STORAGE_KEYS.version, isStoredVersion)
  return result.status === 'ok' ? result.value.version : null
}

/**
 * Checks the saved data's version and brings it up to date. Run this once,
 * before anything is read. It only ever touches this app's own keys.
 */
export function prepareStorage(
  migrations: readonly Migration[] = MIGRATIONS,
  currentVersion: number = CURRENT_SCHEMA_VERSION,
): StoragePreparation {
  const storage = getStorage()
  if (storage === null) return 'unavailable'

  const stored = readSchemaVersion()
  // No version: a first visit has no data, so it is simply stamped. Data with
  // no version at all must predate versioning, which is version 0.
  let version = stored ?? (listAppKeys().length > 0 ? 0 : currentVersion)

  if (version > currentVersion) return 'newer-version'

  while (version < currentVersion) {
    const step = migrations.find((migration) => migration.from === version)
    if (step === undefined) break // No way forward: the loaders check each section instead.

    try {
      step.migrate(storage)
    } catch {
      return 'unavailable'
    }
    version = step.to
    if (!writeJson(STORAGE_KEYS.version, { version }).ok) return 'unavailable'
  }

  if (stored !== currentVersion) {
    if (!writeJson(STORAGE_KEYS.version, { version: currentVersion }).ok) {
      return 'unavailable'
    }
  }
  return 'ready'
}
