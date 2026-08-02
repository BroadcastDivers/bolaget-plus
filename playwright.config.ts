import { defineConfig, devices } from '@playwright/test'

// Two classes of test live in e2e/, and they are kept in separate projects
// because only one of them says anything about this repository:
//
//   matching            mocked fetch, no network, no browser. Deterministic,
//                       so CI gates on it and the README badge reports it.
//   smoke / live-api    drive the live Systembolaget site and query
//                       Vivino/Untappd for real. Run nightly; they fail when
//                       those sites change or are down, which is worth an
//                       alert but is not a build status.
export default defineConfig({
  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: !!process.env.CI,
  // Configure projects for major browsers.
  projects: [
    {
      name: 'matching',
      testMatch: /api-matching\.spec\.ts/,
      use: {}
    },
    {
      name: 'smoke',
      testMatch: /end-to-end\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'live-api',
      testMatch: /api-live\.spec\.ts/,
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
