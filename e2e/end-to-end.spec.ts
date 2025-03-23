import { test, expect } from './fixtures'
import { assert } from 'console'

test('visiting wine page shows rating-container', async ({
  page,
  extensionId
}) => {
  // arrange
  await page.goto(`chrome-extension://${extensionId}/popup.html`)
  await page.waitForSelector('.settings')
  await expect(page.locator('#enabled')).toBeChecked()
  await expect(page.locator('#wine')).toBeChecked()

  // act
  await page.goto('https://www.systembolaget.se/produkt/vin/amadio-203701/')
  await page.getByRole('link', { name: 'Jag har fyllt 20 år' }).click()
  await page.getByRole('button', { name: 'Slå på och acceptera alla' }).click()
  await page.reload()
  await page.waitForSelector('#rating-container')

  // assert
  assert(page.locator('#rating-container'))
})

test('visiting beer page shows rating-container with votes', async ({
  page,
  extensionId
}) => {
  // arrange
  await page.goto(`chrome-extension://${extensionId}/popup.html`)
  await page.waitForSelector('.settings')
  await expect(page.locator('#enabled')).toBeChecked()
  await expect(page.locator('#beer')).toBeChecked()

  // act
  await page.goto('https://www.systembolaget.se/produkt/ol/pabst-155315/')
  await page.getByRole('link', { name: 'Jag har fyllt 20 år' }).click()
  await page.getByRole('button', { name: 'Slå på och acceptera alla' }).click()
  await page.reload()
  await page.locator('#rating-container').waitFor()

  // assert
  const res = await page.locator('#rating-container').textContent()
  assert(res?.includes('röster'))
})

test('visiting a wine page with wine toggle disabled should not show wine', async ({
  page,
  extensionId
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
  await page.getByRole('button', { name: 'Slå på och acceptera alla' }).click()
  await page.reload()

  // assert
  assert(!page.locator('#rating-container'))
})

//TODO: Add a test that checks a wine page and also checks that there is a
// rating-container with votes. Blocked by https://github.com/BroadcastDivers/bolaget-plus/pull/56
