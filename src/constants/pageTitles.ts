export const APP_NAME = 'Math Practice App'

/** The name of each page, as the tab, the history and a screen reader say it. */
const NOT_FOUND = 'Page Not Found'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Home',
  '/practice/setup': 'Practice Setup',
  '/practice/session': 'Practice',
  '/practice/summary': 'Session Summary',
  '/statistics': 'Statistics',
  '/settings': 'Settings',
}

/** The page's name: the name of the route, or "Page Not Found" for any other address. */
export function pageTitle(pathname: string): string {
  // A trailing slash makes no difference to which page it is.
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return PAGE_TITLES[path] ?? NOT_FOUND
}

/** What a screen reader is told on arriving at a page: "Statistics page", or "Page not found". */
export function pageAnnouncement(pathname: string): string {
  const title = pageTitle(pathname)
  return title === NOT_FOUND ? 'Page not found' : `${title} page`
}

/** What the browser tab says: the page, then the app. The home page is the app's own name. */
export function documentTitle(pathname: string): string {
  const title = pageTitle(pathname)
  return title === 'Home' ? APP_NAME : `${title} – ${APP_NAME}`
}
