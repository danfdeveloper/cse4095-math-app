import styles from './RouteLoading.module.css'

/**
 * Shown only if the app is opened straight onto a page that is still being
 * downloaded (such as a bookmark of Statistics), for the moment that takes.
 */
export function RouteLoading() {
  return (
    <p className={styles.loading} role="status">
      Loading…
    </p>
  )
}
