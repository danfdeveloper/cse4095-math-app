import type { PracticeMode } from '../../types/session'
import { OptionCard } from '../common/OptionCard'
import { OptionGroup } from '../common/OptionGroup'

interface ReviewModeSelectorProps {
  value: PracticeMode
  onChange: (mode: PracticeMode) => void
  /** How many mistakes are still to practice, whatever the operation and level. */
  activeMistakes: number
}

/**
 * Ordinary practice, or practice on questions like the ones the student got
 * wrong. The second cannot be chosen while there are no mistakes to practice,
 * and the card says so in words.
 */
export function ReviewModeSelector({
  value,
  onChange,
  activeMistakes,
}: ReviewModeSelectorProps) {
  const hasMistakes = activeMistakes > 0

  return (
    <OptionGroup legend="What kind of practice?">
      <OptionCard
        type="radio"
        name="practice-mode"
        value="regular"
        label="Regular practice"
        description="Questions picked for you at random."
        checked={value === 'regular'}
        onChange={() => onChange('regular')}
      />
      <OptionCard
        type="radio"
        name="practice-mode"
        value="mistake-review"
        label="Practice mistakes"
        description={
          hasMistakes
            ? `${activeMistakes} ${activeMistakes === 1 ? 'mistake' : 'mistakes'} to practice. Questions like the ones you got wrong.`
            : 'No mistakes to practice yet. Questions you get wrong will show up here.'
        }
        disabled={!hasMistakes}
        checked={value === 'mistake-review'}
        onChange={() => onChange('mistake-review')}
      />
    </OptionGroup>
  )
}
