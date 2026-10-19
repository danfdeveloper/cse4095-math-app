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
}

export function SessionLengthSelector({
  value,
  onChange,
}: SessionLengthSelectorProps) {
  return (
    <OptionGroup legend="How many questions?">
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
