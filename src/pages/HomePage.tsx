import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { ButtonLink } from '../components/common/Button'
import { ResumeSession } from '../components/practice/ResumeSession'
import styles from './HomePage.module.css'

export function HomePage() {
  const location = useLocation()
  const navigate = useNavigate()
  // The settings page sends the student here after erasing everything. The
  // notice is remembered for this visit only, and then taken out of the
  // history entry, so reloading the page does not announce it a second time.
  const [dataCleared] = useState(
    () =>
      (location.state as { dataCleared?: unknown } | null)?.dataCleared ===
      true,
  )
  useEffect(() => {
    if (dataCleared) navigate(location.pathname, { replace: true, state: null })
  }, [dataCleared, location.pathname, navigate])

  return (
    <section className={styles.home}>
      {/* Decoration only: a rainbow that stands still. */}
      <div className={styles.rainbow} aria-hidden="true" />
      <h1>Welcome to Math Practice!</h1>
      {dataCleared && (
        <p role="status" className={styles.notice}>
          All of your saved data was erased. The app is back the way it was when
          you first opened it.
        </p>
      )}
      <p className={styles.welcome}>
        Practice adding, subtracting, multiplying, and dividing with fun
        flashcards. Ready to become a math star?
      </p>
      <ResumeSession />
      <div className={styles.actions}>
        <ButtonLink to="/practice/setup">Start Practice</ButtonLink>
        <ButtonLink to="/statistics" variant="secondary">
          View Statistics
        </ButtonLink>
        <ButtonLink to="/settings" variant="secondary">
          Settings
        </ButtonLink>
      </div>
    </section>
  )
}
