import styles from './SkipLink.module.css'

/** The id of the page's main content, which the skip link leads to. */
export const MAIN_CONTENT_ID = 'main-content'

/**
 * The first thing Tab reaches. It stays out of sight until then, and lets
 * someone using a keyboard get past the navigation, which is the same on every
 * page, to what the page is about.
 */
export function SkipLink() {
  return (
    <a
      className={styles.skip}
      href={`#${MAIN_CONTENT_ID}`}
      onClick={(event) => {
        // Move focus there ourselves, which leaves the address as it is.
        event.preventDefault()
        document.getElementById(MAIN_CONTENT_ID)?.focus()
      }}
    >
      Skip to main content
    </a>
  )
}
