import type { Accent } from '../../constants/accents'
import { useId } from 'react'
import styles from './AnswerChoice.module.css'

interface AnswerChoiceProps {
  value: number
  /** A colour for the choice. It carries no meaning: no choice looks right or wrong. */
  accent?: Accent
  /** Which choice this is, from 1, and how many there are. The number key with that digit picks it. */
  position?: number
  count?: number
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
  accent,
  position,
  count,
  selected,
  disabled = false,
  onSelect,
}: AnswerChoiceProps) {
  const descriptionId = useId()
  const hasPosition = position !== undefined

  return (
    <>
      {/* Beside the button, not in it, so that it describes the choice without becoming part of its name. */}
      {hasPosition && (
        <span id={descriptionId} className="visually-hidden">
          {count === undefined
            ? `Answer ${position}`
            : `Answer ${position} of ${count}`}
        </span>
      )}
      <button
        type="button"
        className={styles.choice}
        data-accent={accent}
        aria-pressed={selected}
        // Named by its number, as it looks; its place and its key are said after.
        aria-describedby={hasPosition ? descriptionId : undefined}
        aria-keyshortcuts={hasPosition ? String(position) : undefined}
        disabled={disabled}
        onClick={() => onSelect(value)}
      >
        <span className={styles.indicator} aria-hidden="true">
          {selected ? '✓' : ''}
        </span>
        <span>{value}</span>
        {/* A hint for keyboards; the key itself is announced through aria-keyshortcuts. */}
        {hasPosition && (
          <span className={styles.key} aria-hidden="true">
            {position}
          </span>
        )}
      </button>
    </>
  )
}
