import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: !!process.env.CI,
  // Configure projects for major browsers.
  projects: [
    {
      name: 'chromium',
      testIgnore: /api-integration\.spec\.ts/, // Exclude API tests from the chromium project
      testMatch: /.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'api',
      testMatch: /api-integration\.spec\.ts/,
      use: {}
    }
  ],
  // Reporter to use
  reporter: 'html',
  // Retry on CI only.
  retries: process.env.CI ? 2 : 0,
  testDir: 'e2e',
  use: {
    headless: true,
    // Collect trace when retrying the failed test.
    trace: 'on-first-retry'
  },
  // Opt out of parallel tests on CI.
  workers: process.env.CI ? 1 : undefined
})
