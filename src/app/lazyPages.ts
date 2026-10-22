/**
 * The Statistics and Settings pages are not needed to start practicing, so
 * they are downloaded only when one is first opened. That keeps the first
 * download small (TODO Task 85). The page shown before stays on screen while
 * the next one loads, which takes a moment on a slow connection at most.
 */
export const statisticsRoute = {
  lazy: async () => ({
    Component: (await import('../pages/StatisticsPage')).StatisticsPage,
  }),
}

export const settingsRoute = {
  lazy: async () => ({
    Component: (await import('../pages/SettingsPage')).SettingsPage,
  }),
}
