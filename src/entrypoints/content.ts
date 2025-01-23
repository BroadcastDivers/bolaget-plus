import sentinel from 'sentinel-js'
import * as domUtils from '@/components/domUtils'
import { fetchRatingFromUntappd, fetchRating } from '@/components/api'
import { translations } from '../translations'
import * as productUtils from '@/components/productUtils'
import { wineFeatureEnabled } from '@/components/settings'
import {
  ProductType,
  RatingResultStatus,
  type RatingResponse
} from '@/@types/types'

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

  const productType = productUtils.getProductType()
  if (fetchingRatingInProgress || productType === ProductType.Uncertain) {
    return
  }

  // FETCH SETTINGS - TODO:
  const wineEnabled = wineFeatureEnabled.getValue()
  const beerEnabled = beerFeatureEnabled.getValue()

  domUtils.injectRatingContainer()

  if (productType == ProductType.Wine && !productUtils.isBottle()) {
    domUtils.setMessage(translations.notOnBottle)
    return
  }

  const productName = productUtils.getProductName()
  if (!productName) {
    return
  }

  try {
    fetchingRatingInProgress = true
    domUtils.showLoadingSpinner()

    const rating = await fetchRating(productName, productType)
    await handleRating(productType, rating)
  } catch (error) {
    console.error(`Error fetching rating for ${productName}:`, error)
    domUtils.setMessage(translations.noMatch)
  } finally {
    fetchingRatingInProgress = false
  }
}

async function handleRating(productType: ProductType, rating: RatingResponse) {
  switch (rating.status) {
    case RatingResultStatus.Found:
      domUtils.setRating(productType, rating.rating, rating.votes, rating.link)
      return
    case RatingResultStatus.Uncertain:
      domUtils.setUncertain(productType, rating.link)
      return
    default:
      domUtils.setMessage(translations.noMatch)
      return
  }
}
