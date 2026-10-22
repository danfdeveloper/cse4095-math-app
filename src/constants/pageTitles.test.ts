import { describe, expect, it } from 'vitest'
import {
  APP_NAME,
  documentTitle,
  pageAnnouncement,
  pageTitle,
} from './pageTitles'

describe('pageTitle', () => {
  it.each([
    ['/', 'Home'],
    ['/practice/setup', 'Practice Setup'],
    ['/practice/session', 'Practice'],
    ['/practice/summary', 'Session Summary'],
    ['/statistics', 'Statistics'],
    ['/settings', 'Settings'],
  ])('names %s as "%s"', (path, title) => {
    expect(pageTitle(path)).toBe(title)
  })

  it.each([
    '/nowhere',
    '/practice',
    '/practice/setup/extra',
    '/Statistics',
    '',
  ])('calls %j "Page Not Found"', (path) => {
    expect(pageTitle(path)).toBe('Page Not Found')
  })

  it('ignores a slash on the end', () => {
    expect(pageTitle('/statistics/')).toBe('Statistics')
    expect(pageTitle('/practice/setup//')).toBe('Practice Setup')
  })

  it('gives every page its own name', () => {
    const names = [
      '/',
      '/practice/setup',
      '/practice/session',
      '/practice/summary',
      '/statistics',
      '/settings',
      '/nowhere',
    ].map(pageTitle)

    expect(new Set(names).size).toBe(names.length)
  })
})

describe('documentTitle', () => {
  it('puts the page before the app’s name', () => {
    expect(documentTitle('/statistics')).toBe(`Statistics – ${APP_NAME}`)
    expect(documentTitle('/nowhere')).toBe(`Page Not Found – ${APP_NAME}`)
  })

  it('is just the app’s name on the home page', () => {
    expect(documentTitle('/')).toBe(APP_NAME)
  })

  it('differs for every page, so the tab says where you are', () => {
    const titles = ['/', '/practice/setup', '/statistics', '/settings'].map(
      documentTitle,
    )

    expect(new Set(titles).size).toBe(4)
  })
})

describe('pageAnnouncement', () => {
  it.each([
    ['/', 'Home page'],
    ['/practice/setup', 'Practice Setup page'],
    ['/practice/session', 'Practice page'],
    ['/practice/summary', 'Session Summary page'],
    ['/statistics', 'Statistics page'],
    ['/settings', 'Settings page'],
  ])('says %s is the "%s"', (path, said) => {
    expect(pageAnnouncement(path)).toBe(said)
  })

  it('says so plainly when there is no such page', () => {
    expect(pageAnnouncement('/nowhere')).toBe('Page not found')
  })
})
