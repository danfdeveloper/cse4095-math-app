import { ButtonLink } from '../components/common/Button'
import styles from './HomePage.module.css'

export function HomePage() {
  return (
    <section className={styles.home}>
      <h1>Welcome to Math Practice!</h1>
      <p className={styles.welcome}>
        Practice adding, subtracting, multiplying, and dividing with fun
        flashcards. Ready to become a math star?
      </p>
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
