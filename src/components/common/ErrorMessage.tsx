import type { ReactNode } from 'react'
import { ButtonLink } from './Button'
import styles from './ErrorMessage.module.css'

interface ErrorMessageProps {
  title: string
  /** What happened, in plain words. Never technical details. */
  children: ReactNode
  /**
   * Load the home page afresh, instead of moving there inside the app. Used
   * after something broke, so that nothing broken is carried along.
   */
  reload?: boolean
}

/** A friendly message for when something went wrong, with a safe way back home. */
export function ErrorMessage({
  title,
  children,
  reload = false,
}: ErrorMessageProps) {
  return (
    <section className={styles.error}>
      <h1>{title}</h1>
      <div className={styles.text}>{children}</div>
      <ButtonLink to="/" reloadDocument={reload}>
        Return Home
      </ButtonLink>
    </section>
  )
}
