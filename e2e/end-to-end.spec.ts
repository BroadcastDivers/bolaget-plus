import { expect, test } from './fixtures'
import { openPage, RATING_TIMEOUT } from './systembolaget'

// These tests drive the live Systembolaget site, so they break when it changes.
// They run in the nightly smoke workflow, not in CI — see playwright.config.ts.

test('visiting wine page shows rating-container', async ({
  extensionId,
  page
}) => {
  // arrange
  await page.goto(`chrome-extension://${extensionId}/popup.html`)
  await page.waitForSelector('.settings')
  await expect(page.locator('#enabled')).toBeChecked()
  await expect(page.locator('#wine')).toBeChecked()

  // act
  await openPage(
    page,
    'https://www.systembolaget.se/produkt/vin/amadio-203701/'
  )
  await page.waitForSelector('#rating-container', { timeout: RATING_TIMEOUT })

  // assert
  await expect(page.locator('#rating-container')).toBeVisible()
})

test('visiting beer page shows rating-container with votes', async ({
  extensionId,
  page
}) => {
  // arrange
  await page.goto(`chrome-extension://${extensionId}/popup.html`)
  await page.waitForSelector('.settings')
  await expect(page.locator('#enabled')).toBeChecked()
  await expect(page.locator('#beer')).toBeChecked()

  // act
  await openPage(page, 'https://www.systembolaget.se/produkt/ol/pabst-155315/')
  await page.locator('#rating-container').waitFor({ timeout: RATING_TIMEOUT })

  // Wait for the spinner to be removed
  await page.waitForSelector('.bp-spinner', {
    state: 'detached',
    timeout: RATING_TIMEOUT
  })
  await page.waitForSelector('#rating-container-body')
  // assert
  const res = await page.locator('#rating-container').textContent()
  expect(res).toMatch(/(votes|röster)/i)
})

test('visiting cider page shows rating-container with votes', async ({
  extensionId,
  page
}) => {
  // arrange
  await page.goto(`chrome-extension://${extensionId}/popup.html`)
  await page.waitForSelector('.settings')
  await expect(page.locator('#enabled')).toBeChecked()
  await expect(page.locator('#cider')).toBeChecked()

  // act
  await openPage(
    page,
    'https://www.systembolaget.se/produkt/cider-blanddrycker/somersby-182435/'
  )
  await page.locator('#rating-container').waitFor({ timeout: RATING_TIMEOUT })

  // Wait for the spinner to be removed
  await page.waitForSelector('.bp-spinner', {
    state: 'detached',
    timeout: RATING_TIMEOUT
  })
  await page.waitForSelector('#rating-container-body')
  // assert
  const res = await page.locator('#rating-container').textContent()
  expect(res).toMatch(/(votes|röster)/i)
})

test('visiting a wine page with wine toggle disabled should not show wine', async ({
  extensionId,
  page
}) => {
  // arrange
  await page.goto(`chrome-extension://${extensionId}/popup.html`)
  await page.waitForSelector('.settings')

  await expect(page.locator('#enabled')).toBeChecked()
  await expect(page.locator('#wine')).toBeChecked()
  await page.locator('div:nth-child(2) > .switch > .slider').click()
  await expect(page.locator('#wine')).not.toBeChecked()

  // act
  await openPage(
    page,
    'https://www.systembolaget.se/produkt/vin/amadio-203701/'
  )

  // assert
  await expect(page.locator('#rating-container')).not.toBeVisible()
})

test('visiting a wine page shows rating-container with ratings and stars', async ({
  extensionId,
  page
}) => {
  // arrange
  await page.goto(`chrome-extension://${extensionId}/popup.html`)
  await page.waitForSelector('.settings')
  await expect(page.locator('#enabled')).toBeChecked()
  await expect(page.locator('#wine')).toBeChecked()

  // act
  await openPage(
    page,
    'https://www.systembolaget.se/produkt/vin/bread-butter-7667101/'
  )

  // Wait for the spinner to be removed
  await page.waitForSelector('.bp-spinner', {
    state: 'detached',
    timeout: RATING_TIMEOUT
  })

  await page.waitForSelector('#rating-container-body', {
    timeout: RATING_TIMEOUT
  })

  // assert
  const ratingContainer = page.locator('#rating-container-body')
  await expect(ratingContainer).toBeVisible()

  const stars = ratingContainer.locator('.bp-rating-row svg')
  await expect(stars).toHaveCount(5)

  // Check for the presence of text indicating ratings (e.g., "votes" or "röster")
  const ratingText = await ratingContainer.textContent()
  expect(ratingText).toMatch(/(votes|röster)/i)

  // Check for the Vivino link
  const vivinoLink = ratingContainer.locator('a[href*="vivino.com"]')
  await expect(vivinoLink).toBeVisible()
})

test('visiting wine list page shows rating badges on product cards', async ({
  extensionId,
  page
}) => {
  await page.goto(`chrome-extension://${extensionId}/popup.html`)
  await page.waitForSelector('.settings')
  await expect(page.locator('#enabled')).toBeChecked()
  await expect(page.locator('#wine')).toBeChecked()

  await openPage(page, 'https://www.systembolaget.se/sortiment/vin/')

  await page.waitForSelector('.bp-card-rating', { timeout: RATING_TIMEOUT })
  await expect(page.locator('.bp-card-rating').first()).toBeVisible()
})
