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
  await page.getByRole('button', { name: 'Acceptera alla kakor' }).click()
  await page.reload()
  await page.waitForSelector('#rating-container')

  // assert
  await expect(page.locator('#rating-container')).toBeVisible()
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
  await page.getByRole('button', { name: 'Acceptera alla kakor' }).click()
  await page.reload()
  await page.locator('#rating-container').waitFor()

  // Wait for the spinner to be removed
  await page.waitForSelector('.bp-spinner', { state: 'detached' });
  await page.waitForSelector('#rating-container-body');
  // assert
  const res = await page.locator('#rating-container').textContent()
  expect(res).toMatch(/(votes|röster)/i)
})

test('visiting cider page shows rating-container with votes', async ({
  page,
  extensionId
}) => {
  // arrange
  await page.goto(`chrome-extension://${extensionId}/popup.html`)
  await page.waitForSelector('.settings')
  await expect(page.locator('#enabled')).toBeChecked()
  await expect(page.locator('#cider')).toBeChecked()

  // act
  await page.goto(
    'https://www.systembolaget.se/produkt/cider-blanddrycker/somersby-182435/'
  )
  await page.getByRole('link', { name: 'Jag har fyllt 20 år' }).click()
  await page.getByRole('button', { name: 'Acceptera alla kakor' }).click()
  await page.reload()
  await page.locator('#rating-container').waitFor()

  // Wait for the spinner to be removed
  await page.waitForSelector('.bp-spinner', { state: 'detached' });
  await page.waitForSelector('#rating-container-body');
  // assert
  const res = await page.locator('#rating-container').textContent()
  expect(res).toMatch(/(votes|röster)/i)
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
  await page.getByRole('button', { name: 'Acceptera alla kakor' }).click()
  await page.reload()

  // assert
  await expect(page.locator('#rating-container')).not.toBeVisible()
})

test('visiting a wine page shows rating-container with ratings and stars', async ({
  page,
  extensionId
}) => {
  // arrange
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.waitForSelector('.settings');
  await expect(page.locator('#enabled')).toBeChecked();
  await expect(page.locator('#wine')).toBeChecked();

  // act
  await page.goto('https://www.systembolaget.se/produkt/vin/bread-butter-7667101/');
  await page.getByRole('link', { name: 'Jag har fyllt 20 år' }).click();
  await page.getByRole('button', { name: 'Acceptera alla kakor' }).click();
  await page.reload();

  // Wait for the spinner to be removed
  await page.waitForSelector('.bp-spinner', { state: 'detached' });

  await page.waitForSelector('#rating-container-body');

  // assert
  const ratingContainer = page.locator('#rating-container-body');
  await expect(ratingContainer).toBeVisible();

  const stars = ratingContainer.locator('.bp-rating-row svg');
  await expect(stars).toHaveCount(5);

  // Check for the presence of text indicating ratings (e.g., "votes" or "röster")
  const ratingText = await ratingContainer.textContent();
  expect(ratingText).toMatch(/(votes|röster)/i);

  // Check for the Vivino link
  const vivinoLink = ratingContainer.locator('a[href*="vivino.com"]');
  await expect(vivinoLink).toBeVisible();
});

test('visiting wine list page shows rating badges on product cards', async ({
  page,
  extensionId
}) => {
  await page.goto(`chrome-extension://${extensionId}/popup.html`)
  await page.waitForSelector('.settings')
  await expect(page.locator('#enabled')).toBeChecked()
  await expect(page.locator('#wine')).toBeChecked()

  await page.goto('https://www.systembolaget.se/sortiment/vin/')
  await page.getByRole('link', { name: 'Jag har fyllt 20 år' }).click()
  await page.getByRole('button', { name: 'Acceptera alla kakor' }).click()
  await page.reload()

  await page.waitForSelector('.bp-card-rating', { timeout: 20000 })
  await expect(page.locator('.bp-card-rating').first()).toBeVisible()
})