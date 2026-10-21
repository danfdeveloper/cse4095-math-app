import { OPERATION_ACCENT } from '../../constants/accents'
import { MATH_OPERATIONS, OPERATION_INFO } from '../../constants/practice'
import type { MathOperation } from '../../types/question'
import { OptionCard } from '../common/OptionCard'
import { OptionGroup } from '../common/OptionGroup'

interface OperationSelectorProps {
  selected: MathOperation[]
  onChange: (operations: MathOperation[]) => void
  /** The group's name; the settings page words it differently. */
  legend?: string
}

export function OperationSelector({
  selected,
  onChange,
  legend = 'What do you want to practice?',
}: OperationSelectorProps) {
  const allSelected = selected.length === MATH_OPERATIONS.length

  function toggle(operation: MathOperation) {
    const next = selected.includes(operation)
      ? selected.filter((item) => item !== operation)
      : [...selected, operation]
    // Keep a stable order no matter which card was clicked first.
    onChange(MATH_OPERATIONS.filter((item) => next.includes(item)))
  }

  return (
    <OptionGroup legend={legend}>
      {MATH_OPERATIONS.map((operation) => (
        <OptionCard
          key={operation}
          type="checkbox"
          label={OPERATION_INFO[operation].label}
          symbol={OPERATION_INFO[operation].symbol}
          accent={OPERATION_ACCENT[operation]}
          checked={selected.includes(operation)}
          onChange={() => toggle(operation)}
        />
      ))}
      <OptionCard
        type="checkbox"
        label="Mixed operations"
        description="Practice all four together."
        accent="pink"
        fullRow
        checked={allSelected}
        onChange={() => onChange(allSelected ? [] : [...MATH_OPERATIONS])}
      />
    </OptionGroup>
  )
}
