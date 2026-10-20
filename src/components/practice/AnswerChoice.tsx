import styles from './AnswerChoice.module.css'

interface AnswerChoiceProps {
  value: number
  selected: boolean
  /** Set once the card is flipped, so the answer can no longer be changed. */
  disabled?: boolean
  onSelect: (value: number) => void
}

/**
 * One multiple-choice answer. A toggle button: the selected one is announced
 * as pressed, and also shows a check mark and a heavier outline, so the state
 * is not carried by color alone.
 */
export function AnswerChoice({
  value,
  selected,
  disabled = false,
  onSelect,
}: AnswerChoiceProps) {
  return (
    <button
      type="button"
      className={styles.choice}
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => onSelect(value)}
    >
      <span className={styles.indicator} aria-hidden="true">
        {selected ? '✓' : ''}
      </span>
      <span>{value}</span>
    </button>
  )
}
