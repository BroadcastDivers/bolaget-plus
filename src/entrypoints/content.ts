import sentinel from 'sentinel-js'
import * as domUtils from '@/components/domUtils'
import { fetchUntappdRating, fetchVivinoRating } from '@/components/api'
import { translations } from '../translations'
import * as productUtils from '@/components/productUtils'
import { RatingResultStatus, type RatingResponse } from '@/@types/messages'
import { wineFeatureEnabled } from '@/components/settings'

// TODO: this is required for WXT, look into it or make it fetch settings from storage?
export default defineContentScript({
  matches: ['*://*.systembolaget.se/*'],
  main() {
    sentinel.on('h1', tryInsertOnProdcutPage)
  }
})

let fetchingRatingInProgress = false

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
async function tryInsertOnProdcutPage(_: any) {
  // check if extension is enabled
  const enabled = await featuresEnabled.getValue()
  if (!enabled) {
    return
  }
  const url = window.location?.href
  if (
    !url ||
    !['/produkt/vin/', '/produkt/sprit/', '/produkt/ol/'].some((path) =>
      url.includes(path)
    )
  ) {
    return
  }

  if (fetchingRatingInProgress) {
    return
  }

  // FETCH SETTINGS - TODO:
  const wineEnabled = wineFeatureEnabled.getValue()
  const beerEnabled = beerFeatureEnabled.getValue()

  domUtils.injectRatingContainer()
  if (
    window.location?.href.includes('/produkt/vin/') &&
    !productUtils.isBottle()
  ) {
    domUtils.setMessage(translations.notOnBottle)
    return
  }

  fetchingRatingInProgress = true
  const productName = productUtils.getProductName()
  if (!productName) {
    return
  }

  try {
    domUtils.showLoadingSpinner()

    if (window.location.href.includes('/produkt/vin/')) {
      await handleRating(fetchVivinoRating, productName, 'wine')
    }

    if (window.location.href.includes('/produkt/ol/')) {
      await handleRating(fetchUntappdRating, productName, 'beer')
    }
  } catch (error) {
    console.error(`Error fetching rating for ${productName}:`, error)
  } finally {
    fetchingRatingInProgress = false
  }
}

async function handleRating(
  fetchRatingFunction: (productName: string) => Promise<RatingResponse | null>,
  productName: string,
  type: 'wine' | 'beer'
) {
  const response = await fetchRatingFunction(productName)
  console.log('Response:', response)

  if (!response) return

  switch (response?.status) {
    case RatingResultStatus.NotFound:
      domUtils.setMessage(translations.noMatch)
      return
    case RatingResultStatus.Uncertain:
      domUtils.setUncertain(response.link)
      return
    // case RatingResultStatus.Found:
    //   break;
  }

  if (type === 'wine') {
    domUtils.setWineRating(response.rating, response.votes, response.link)
  } else if (type === 'beer') {
    // domUtils.setRating('beer', response.rating, response.votes, response.link);
    domUtils.setWineRating(response.rating, response.votes, response.link)
  }
}
