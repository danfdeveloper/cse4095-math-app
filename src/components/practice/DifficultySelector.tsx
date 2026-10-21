import { DIFFICULTY_ACCENT } from '../../constants/accents'
import { DIFFICULTY_INFO, DIFFICULTY_LEVELS } from '../../constants/practice'
import type { DifficultyLevel } from '../../types/question'
import { OptionCard } from '../common/OptionCard'
import { OptionGroup } from '../common/OptionGroup'

interface DifficultySelectorProps {
  /** The chosen level, or null while nothing is chosen yet. */
  value: DifficultyLevel | null
  onChange: (level: DifficultyLevel) => void
  /** The group's name; the settings page words it differently. */
  legend?: string
}

export function DifficultySelector({
  value,
  onChange,
  legend = 'How hard should it be?',
}: DifficultySelectorProps) {
  return (
    <OptionGroup legend={legend}>
      {DIFFICULTY_LEVELS.map((level) => (
        <OptionCard
          key={level}
          type="radio"
          name="difficulty"
          value={String(level)}
          label={`Level ${level}: ${DIFFICULTY_INFO[level].label}`}
          description={DIFFICULTY_INFO[level].description}
          accent={DIFFICULTY_ACCENT[level]}
          checked={value === level}
          onChange={() => onChange(level)}
        />
      ))}
    </OptionGroup>
  )
}
