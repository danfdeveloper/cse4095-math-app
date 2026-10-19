import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest globals are disabled, so React Testing Library cannot register its
// own automatic cleanup. Unmount rendered trees after every test instead.
afterEach(() => {
  cleanup()
})
