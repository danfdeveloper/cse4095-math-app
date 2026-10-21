import { useId, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../components/common/Button'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { OptionCard } from '../components/common/OptionCard'
import { OptionGroup } from '../components/common/OptionGroup'
import { DifficultySelector } from '../components/practice/DifficultySelector'
import { OperationSelector } from '../components/practice/OperationSelector'
import { SessionLengthSelector } from '../components/practice/SessionLengthSelector'
import { MASTERY_THRESHOLD_RANGE } from '../constants/settings'
import { useSettings } from '../hooks/useSettings'
import styles from './SettingsPage.module.css'

export function SettingsPage() {
  const navigate = useNavigate()
  const { settings, updateSettings, clearAllData } = useSettings()
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [clearFailed, setClearFailed] = useState(false)
  const optionsId = useId()
  const startingId = useId()
  const mistakesId = useId()
  const thresholdId = useId()
  const thresholdNoteId = useId()
  const dataId = useId()
  const thresholdChoices = Array.from(
    {
      length: MASTERY_THRESHOLD_RANGE.max - MASTERY_THRESHOLD_RANGE.min + 1,
    },
    (_, index) => MASTERY_THRESHOLD_RANGE.min + index,
  )

  function handleClear() {
    setConfirmingClear(false)
    if (clearAllData()) {
      // Everything is back to how it started, so say so where the student lands.
      navigate('/', { state: { dataCleared: true } })
    } else {
      setClearFailed(true)
    }
  }

  return (
    <>
      <h1>Settings</h1>
      <p className={styles.intro}>
        Your changes are saved automatically on this device.
      </p>

      <section className={styles.section} aria-labelledby={optionsId}>
        <h2 id={optionsId}>While you practice</h2>
        <OptionGroup legend="Turn these on or off">
          <OptionCard
            type="checkbox"
            label="Sound effects"
            accent="pink"
            description="Sounds are coming soon. Your choice will be remembered."
            checked={settings.soundEffectsEnabled}
            onChange={() =>
              updateSettings({
                soundEffectsEnabled: !settings.soundEffectsEnabled,
              })
            }
          />
          <OptionCard
            type="checkbox"
            label="Card flip animation"
            accent="teal"
            description="Turn the card over with a quick motion. When off, it changes sides at once."
            checked={settings.cardAnimationEnabled}
            onChange={() =>
              updateSettings({
                cardAnimationEnabled: !settings.cardAnimationEnabled,
              })
            }
          />
          <OptionCard
            type="checkbox"
            label="Show explanations"
            accent="yellow"
            description="Show how to solve each problem on the back of the card."
            checked={settings.showExplanations}
            onChange={() =>
              updateSettings({ showExplanations: !settings.showExplanations })
            }
          />
        </OptionGroup>
      </section>

      <section className={styles.section} aria-labelledby={startingId}>
        <h2 id={startingId}>Starting choices</h2>
        <p className={styles.note}>
          These are already picked when you open Practice Setup. You can still
          change them for any one session.
        </p>
        <div className={styles.fields}>
          <OperationSelector
            legend="Which operations are picked to begin with?"
            selected={settings.defaultOperations}
            onChange={(defaultOperations) =>
              updateSettings({ defaultOperations })
            }
          />
          <DifficultySelector
            legend="Which level is picked to begin with?"
            value={settings.defaultDifficulty}
            onChange={(defaultDifficulty) =>
              updateSettings({ defaultDifficulty })
            }
          />
          <SessionLengthSelector
            legend="How many questions to begin with?"
            value={settings.defaultSessionLength}
            onChange={(defaultSessionLength) =>
              updateSettings({ defaultSessionLength })
            }
          />
        </div>
      </section>

      <section className={styles.section} aria-labelledby={mistakesId}>
        <h2 id={mistakesId}>Practicing mistakes</h2>
        <label htmlFor={thresholdId} className={styles.fieldLabel}>
          Correct answers to master a mistake
        </label>
        <select
          id={thresholdId}
          className={styles.select}
          value={settings.masteryThreshold}
          aria-describedby={thresholdNoteId}
          onChange={(event) =>
            updateSettings({ masteryThreshold: Number(event.target.value) })
          }
        >
          {thresholdChoices.map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>
        <p id={thresholdNoteId} className={styles.note}>
          How many similar questions you must get right before a mistake counts
          as mastered. A change applies from now on. Mistakes you have already
          mastered stay mastered.
        </p>
      </section>

      <section className={styles.section} aria-labelledby={dataId}>
        <h2 id={dataId}>Your data</h2>
        <p className={styles.note}>
          Everything is kept on this device only. You can erase all of it,
          including your settings, practice history, statistics and mistakes.
        </p>
        <Button variant="secondary" onClick={() => setConfirmingClear(true)}>
          Clear All Application Data
        </Button>
        {clearFailed && (
          <p role="alert" className={styles.error}>
            Your data could not be erased. The browser would not let the app
            remove it. Nothing was changed.
          </p>
        )}
      </section>

      <ConfirmDialog
        open={confirmingClear}
        title="Erase everything?"
        message="This will permanently erase all of your settings, practice history, statistics and mistakes. This cannot be undone."
        confirmLabel="Yes, Erase Everything"
        cancelLabel="No, Keep My Data"
        onCancel={() => setConfirmingClear(false)}
        onConfirm={handleClear}
      />
    </>
  )
}
