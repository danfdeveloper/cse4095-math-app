import { Link, matchPath, useLocation } from 'react-router'
import styles from './Navigation.module.css'

interface NavItem {
  label: string
  to: string
  /** Path prefix that marks this item as the current section. */
  section: string
  /** Match only the exact path, so "/" is not active on every page. */
  exact?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', to: '/', section: '/', exact: true },
  { label: 'Practice', to: '/practice/setup', section: '/practice' },
  { label: 'Statistics', to: '/statistics', section: '/statistics' },
  { label: 'Settings', to: '/settings', section: '/settings' },
]

export function Navigation() {
  const { pathname } = useLocation()

  return (
    <nav className={styles.nav} aria-label="Main">
      <ul className={styles.list}>
        {NAV_ITEMS.map((item) => {
          const isCurrent =
            matchPath(
              { path: item.section, end: item.exact ?? false },
              pathname,
            ) !== null

          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={styles.link}
                aria-current={isCurrent ? 'page' : undefined}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
