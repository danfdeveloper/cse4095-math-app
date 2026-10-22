import { formatQuestionCount } from '../../utils/format'
import { ConfirmDialog } from '../common/ConfirmDialog'

interface EndSessionDialogProps {
  open: boolean
  /** How many questions have been answered so far. */
  answered: number
  onKeepPracticing: () => void
  onEnd: () => void
}

/** Asks whether to stop a session that has answers, before it is ended on purpose. */
export function EndSessionDialog({
  open,
  answered,
  onKeepPracticing,
  onEnd,
}: EndSessionDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title="End this session?"
      message={`You have answered ${formatQuestionCount(answered)} so far. Do you want to stop and see how you did?`}
      confirmLabel="End Session"
      cancelLabel="Keep Practicing"
      onCancel={onKeepPracticing}
      onConfirm={onEnd}
    />
  )
}
