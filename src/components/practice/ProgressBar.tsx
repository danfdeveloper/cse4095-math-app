import styles from './ProgressBar.module.css'

interface ProgressBarProps {
  value: number
  max: number
  /** What the bar measures, for screen readers. */
  label: string
  /** The progress in words, such as "3 of 10 questions answered". */
  valueText: string
}

/** A bar that fills as `value` approaches `max`. Announced as a progress bar. */
export function ProgressBar({
  value,
  max,
  label,
  valueText,
}: ProgressBarProps) {
  const clamped = Math.min(Math.max(value, 0), max)
  const percent = max > 0 ? (clamped / max) * 100 : 0

  return (
    <div
      className={styles.track}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={clamped}
      aria-valuetext={valueText}
    >
      <div className={styles.fill} style={{ width: `${percent}%` }} />
    </div>
  )
}
