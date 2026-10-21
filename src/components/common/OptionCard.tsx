import { useId } from 'react'
import type { Accent } from '../../constants/accents'
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
  /** A colour for the card. It only decorates: the label and the check mark say the rest. */
  accent?: Accent
  checked: boolean
  onChange: () => void
  /**
   * Cannot be chosen. The description should say why, in words: the dashed
   * outline and muted fill are not enough to say it on their own.
   */
  disabled?: boolean
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
  accent,
  checked,
  onChange,
  disabled,
  name,
  value,
}: OptionCardProps) {
  const labelId = useId()
  const descriptionId = useId()

  return (
    <label
      className={`${styles.option} ${fullRow ? styles.fullRow : ''}`}
      data-accent={accent}
    >
      <input
        className={styles.input}
        type={type}
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
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
