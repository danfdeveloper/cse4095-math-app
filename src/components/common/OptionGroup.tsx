import type { ReactNode } from 'react'
import styles from './OptionGroup.module.css'

interface OptionGroupProps {
  legend: string
  children: ReactNode
}

/** A labelled fieldset that lays its option cards out in a responsive grid. */
export function OptionGroup({ legend, children }: OptionGroupProps) {
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.grid}>{children}</div>
    </fieldset>
  )
}
