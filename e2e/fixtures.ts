import { test as base, type BrowserContext, chromium } from '@playwright/test'
import path from 'path'

const pathToExtension = path.resolve('.output/chrome-mv3')

export const test = base.extend<{
  context: BrowserContext
  extensionId: string
}>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixtures must destructure
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ],
      channel: 'chromium',
      headless: false
    })
    await use(context)
    await context.close()
  },
  extensionId: async ({ context }, use) => {
    // The tests always load the MV3 build, whose background is a service
    // worker; it may not have started yet when the fixture runs.
    const workers = context.serviceWorkers()
    const background =
      workers.length > 0
        ? workers[0]
        : await context.waitForEvent('serviceworker')

    const extensionId = background.url().split('/')[2]
    await use(extensionId)
  }
})
export const expect = test.expect
