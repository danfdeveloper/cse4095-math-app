import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Full-page tests take about a second alone, but several runs at once (or a
    // busy machine) can push them past the 5 second default.
    testTimeout: 15_000,
  },
})
