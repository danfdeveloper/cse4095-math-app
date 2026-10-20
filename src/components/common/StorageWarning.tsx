import { useStorageStatus } from '../../hooks/useStorageStatus'
import type { StorageProblem } from '../../services/persistence'
import { Button } from './Button'
import styles from './StorageWarning.module.css'

const MESSAGES: Record<StorageProblem, string> = {
  unavailable:
    'Your progress cannot be saved in this browser right now. You can keep practicing, but your results will be gone when you close this page.',
  full: 'This device is out of space, so your newest results could not be saved. You can keep practicing.',
  'newer-version':
    'Your saved progress was made by a newer version of this app, so it is being left alone. Anything you do now will not be saved.',
}

/** Tells the student, kindly, when their progress cannot be saved. Practice goes on regardless. */
export function StorageWarning() {
  const { problem, dismissed, dismiss } = useStorageStatus()
  if (problem === null || dismissed) return null

  return (
    <div className={styles.region}>
      <div className={styles.warning} role="alert">
        <p className={styles.message}>
          <strong>Heads up:</strong> {MESSAGES[problem]}
        </p>
        <Button variant="secondary" onClick={dismiss}>
          OK
        </Button>
      </div>
    </div>
  )
}
