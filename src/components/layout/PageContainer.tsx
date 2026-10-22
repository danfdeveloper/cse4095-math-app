import type { ReactNode } from 'react'
import styles from './PageContainer.module.css'
import { MAIN_CONTENT_ID } from './SkipLink'

interface PageContainerProps {
  children: ReactNode
}

/** The page's main landmark, with a readable width and responsive spacing. */
export function PageContainer({ children }: PageContainerProps) {
  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1} className={styles.container}>
      {children}
    </main>
  )
}
