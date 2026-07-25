import { defineConfig } from 'vitest/config'
import { WxtVitest } from 'wxt/testing'

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    // Playwright owns e2e/*.spec.ts; vitest only runs the unit tests.
    include: ['src/**/*.test.ts']
  }
})
