import { DIFFICULTY_INFO, DIFFICULTY_LEVELS } from '../../constants/practice'
import type { DifficultyLevel } from '../../types/question'
import { OptionCard } from '../common/OptionCard'
import { OptionGroup } from '../common/OptionGroup'

interface DifficultySelectorProps {
  /** The chosen level, or null while nothing is chosen yet. */
  value: DifficultyLevel | null
  onChange: (level: DifficultyLevel) => void
}

export function DifficultySelector({
  value,
  onChange,
}: DifficultySelectorProps) {
  return (
    <OptionGroup legend="How hard should it be?">
      {DIFFICULTY_LEVELS.map((level) => (
        <OptionCard
          key={level}
          type="radio"
          name="difficulty"
          value={String(level)}
          label={`Level ${level}: ${DIFFICULTY_INFO[level].label}`}
          description={DIFFICULTY_INFO[level].description}
          checked={value === level}
          onChange={() => onChange(level)}
        />
      ))}
    </OptionGroup>
  )
}
