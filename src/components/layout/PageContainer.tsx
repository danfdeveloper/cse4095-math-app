import type { ReactNode } from 'react'
import styles from './PageContainer.module.css'

interface PageContainerProps {
  children: ReactNode
}

/** The page's main landmark, with a readable width and responsive spacing. */
export function PageContainer({ children }: PageContainerProps) {
  return <main className={styles.container}>{children}</main>
}
