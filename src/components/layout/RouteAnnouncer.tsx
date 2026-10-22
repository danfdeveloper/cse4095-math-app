import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { documentTitle, pageAnnouncement } from '../../constants/pageTitles'

/**
 * Keeps the browser tab's title right, and tells a screen reader which page it
 * has arrived at. A page change here is not a page load, so nothing else says so.
 * It is silent when the app first opens, as the page load says that itself.
 */
export function RouteAnnouncer() {
  const { pathname } = useLocation()
  const [announcement, setAnnouncement] = useState('')
  // The page the student was on. An effect can run twice for one page (React
  // does that in development), so a page is announced only when it differs.
  const previous = useRef<string | null>(null)

  useEffect(() => {
    document.title = documentTitle(pathname)
    const was = previous.current
    previous.current = pathname
    if (was === null || was === pathname) return
    setAnnouncement(pageAnnouncement(pathname))
  }, [pathname])

  return (
    <div aria-live="polite" aria-atomic="true" className="visually-hidden">
      {announcement}
    </div>
  )
}
