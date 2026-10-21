import {
  describeSessionLength,
  SESSION_LENGTH_OPTIONS,
} from '../../constants/practice'
import type { SessionLength } from '../../types/session'
import { OptionCard } from '../common/OptionCard'
import { OptionGroup } from '../common/OptionGroup'

interface SessionLengthSelectorProps {
  value: SessionLength
  onChange: (length: SessionLength) => void
  /** The group's name; the settings page words it differently. */
  legend?: string
}

export function SessionLengthSelector({
  value,
  onChange,
  legend = 'How many questions?',
}: SessionLengthSelectorProps) {
  return (
    <OptionGroup legend={legend}>
      {SESSION_LENGTH_OPTIONS.map((length) => (
        <OptionCard
          key={length}
          type="radio"
          name="session-length"
          value={String(length)}
          label={describeSessionLength(length)}
          description={
            length === 'continuous' ? 'Keep going until you stop.' : undefined
          }
          checked={value === length}
          onChange={() => onChange(length)}
        />
      ))}
    </OptionGroup>
  )
}
