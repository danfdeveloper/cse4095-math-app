import { useContext } from 'react'
import {
  StorageStatusContext,
  type StorageStatusApi,
} from '../app/StorageStatusContext'

/** Whether saving is working. Must be used inside AppProvider. */
export function useStorageStatus(): StorageStatusApi {
  const api = useContext(StorageStatusContext)
  if (api === null) {
    throw new Error('useStorageStatus must be used inside <AppProvider>')
  }
  return api
}
