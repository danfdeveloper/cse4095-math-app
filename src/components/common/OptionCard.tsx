import { useId } from 'react'
import styles from './OptionCard.module.css'

interface OptionCardProps {
  /** Checkbox for pick-any choices, radio for pick-one choices. */
  type: 'checkbox' | 'radio'
  label: string
  description?: string
  /** A decorative symbol shown beside the label; the label carries the meaning. */
  symbol?: string
  /** Span every column of the surrounding grid. */
  fullRow?: boolean
  checked: boolean
  onChange: () => void
  /** Shared by every radio in the same group. */
  name?: string
  value?: string
}

/**
 * A large, touch-friendly card wrapping a native checkbox or radio input, so
 * keyboard and screen-reader behavior come from the browser. The selected
 * state shows a check mark and a heavier outline, not color alone.
 */
export function OptionCard({
  type,
  label,
  description,
  symbol,
  fullRow,
  checked,
  onChange,
  name,
  value,
}: OptionCardProps) {
  const labelId = useId()
  const descriptionId = useId()

  return (
    <label className={`${styles.option} ${fullRow ? styles.fullRow : ''}`}>
      <input
        className={styles.input}
        type={type}
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        aria-labelledby={labelId}
        aria-describedby={description ? descriptionId : undefined}
      />
      <span className={styles.card}>
        <span
          className={`${styles.indicator} ${type === 'radio' ? styles.round : ''}`}
          aria-hidden="true"
        >
          {checked ? '✓' : ''}
        </span>
        <span className={styles.text}>
          <span id={labelId} className={styles.label}>
            {symbol && (
              <span className={styles.symbol} aria-hidden="true">
                {symbol}
              </span>
            )}
            {label}
          </span>
          {description && (
            <span id={descriptionId} className={styles.description}>
              {description}
            </span>
          )}
        </span>
      </span>
    </label>
  )
}
