import { describe, expect, it, vi } from 'vitest'
import { SettingsPage } from '../pages/SettingsPage'
import { StatisticsPage } from '../pages/StatisticsPage'

// The test setup swaps these for pages that are there at once; this is the real module.
const { statisticsRoute, settingsRoute } =
  await vi.importActual<typeof import('./lazyPages')>('./lazyPages')

describe('the pages loaded only when first opened', () => {
  it('are loaded by the router when needed, not given up front', () => {
    expect(statisticsRoute).not.toHaveProperty('Component')
    expect(settingsRoute).not.toHaveProperty('Component')
    expect(typeof statisticsRoute.lazy).toBe('function')
    expect(typeof settingsRoute.lazy).toBe('function')
  })

  it('give the Statistics page', async () => {
    expect(await statisticsRoute.lazy()).toEqual({ Component: StatisticsPage })
  })

  it('give the Settings page', async () => {
    expect(await settingsRoute.lazy()).toEqual({ Component: SettingsPage })
  })
})
