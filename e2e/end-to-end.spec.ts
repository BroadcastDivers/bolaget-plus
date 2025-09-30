import { expect, test } from './fixtures'

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
  await page.goto('https://www.systembolaget.se/produkt/vin/amadio-203701/')
  await page.getByRole('link', { name: 'Jag har fyllt 20 år' }).click()
  await page.getByRole('button', { name: 'Acceptera alla kakor' }).click()
  await page.waitForSelector('#rating-container')

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
  await page.goto('https://www.systembolaget.se/produkt/ol/pabst-155315/')
  await page.getByRole('link', { name: 'Jag har fyllt 20 år' }).click()
  await page.getByRole('button', { name: 'Acceptera alla kakor' }).click()
  await page.locator('#rating-container').waitFor()

  // Wait for the spinner to be removed
  await page.waitForSelector('.spinner', { state: 'detached' })
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
  await page.goto('https://www.systembolaget.se/produkt/vin/amadio-203701/')
  await page.getByRole('link', { name: 'Jag har fyllt 20 år' }).click()
  await page.getByRole('button', { name: 'Acceptera alla kakor' }).click()

  // assert
  await expect(page.locator('#rating-container')).not.toBeVisible()
})

test('visiting a wine page shows rating-container with ratings and stars', async ({
  extensionId,
  page
}) => {
  // page.on('console', (msg) => {
  //   if (msg.text().includes('[Vivino API]')) {
  //     console.log(`Extension Console: ${msg.text()}`)
  //   }
  // })

  // page.on('pageerror', (error) => {
  //   console.log(`Page Error: ${error.message}`)
  // })

  // arrange
  await page.goto(`chrome-extension://${extensionId}/popup.html`)
  await page.waitForSelector('.settings')
  await expect(page.locator('#enabled')).toBeChecked()
  await expect(page.locator('#wine')).toBeChecked()

  // act
  await page.goto(
    'https://www.systembolaget.se/produkt/vin/bread-butter-7667101/'
  )
  await page.getByRole('link', { name: 'Jag har fyllt 20 år' }).click()
  await page.getByRole('button', { name: 'Acceptera alla kakor' }).click()

  // Wait for the spinner to be removed
  await page.waitForSelector('.spinner', { state: 'detached' })

  await page.waitForSelector('#rating-container-body')

  // assert
  const ratingContainer = page.locator('#rating-container-body')
  await expect(ratingContainer).toBeVisible()

  // wait for stars to be rendered
  await page.waitForSelector('#rating-container-body svg')
  const stars = ratingContainer.locator('svg')
  await expect(stars).toHaveCount(5)

  // Check for the presence of text indicating ratings (e.g., "votes" or "röster")
  const ratingText = await ratingContainer.textContent()
  expect(ratingText).toMatch(/(votes|röster)/i)

  // Check for the Vivino link
  const vivinoLink = ratingContainer.locator('a[href*="vivino.com"]')
  await expect(vivinoLink).toBeVisible()
})
