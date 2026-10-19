import { Link } from 'react-router'
import styles from './Header.module.css'
import { Navigation } from './Navigation'

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to="/" className={styles.brand}>
          Math Practice App
        </Link>
        <Navigation />
      </div>
    </header>
  )
}
