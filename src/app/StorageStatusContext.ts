import { createContext } from 'react'
import type { StorageProblem } from '../services/persistence'

export interface StorageStatusApi {
  /** What is wrong with saving, if anything. */
  problem: StorageProblem | null
  /** Whether the student has already seen and dismissed the warning for it. */
  dismissed: boolean
  dismiss: () => void
}

export const StorageStatusContext = createContext<StorageStatusApi | null>(null)
