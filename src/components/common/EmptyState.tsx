import type { ReactNode } from 'react'
import styles from './EmptyState.module.css'

interface EmptyStateProps {
  title: string
  message: string
  /** What to do next, such as a button. */
  action?: ReactNode
}

/** A friendly message for a page that has nothing to show yet. */
export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <section className={styles.empty}>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.message}>{message}</p>
      {action}
    </section>
  )
}
