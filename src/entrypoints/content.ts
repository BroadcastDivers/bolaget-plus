import sentinel from 'sentinel-js'

import {
  ProductType,
  type RatingResponse,
  RatingResultStatus
} from '@/@types/types'
import * as productParser from '@/dom/productParser'
import * as ratingUI from '@/dom/ratingUI'
import { TranslationKeys } from '@/locales/translationsKeys'
import { fetchRating } from '@/services/ratingService'
import {
  beerFeatureEnabled,
  featuresEnabled,
  wineFeatureEnabled
} from '@/stores/settings'

export default defineContentScript({
  main() {
    //eslint-disable-next-line @typescript-eslint/no-misused-promises
    sentinel.on('h1', tryInsertOnProductPage)
  },
  matches: ['*://*.systembolaget.se/*']
})

let fetchingRatingInProgress = false

async function fetchAndDisplayRating(
  productName: string,
  productType: ProductType
) {
  try {
    fetchingRatingInProgress = true
    ratingUI.showLoadingSpinner()

    const rating = await fetchRating(productName, productType)
    handleRating(productType, rating)
  } catch {
    ratingUI.setMessage(i18n.t(TranslationKeys.noMatch))
  }
  fetchingRatingInProgress = false
}

function handleRating(productType: ProductType, rating: RatingResponse) {
  switch (rating.status) {
    case RatingResultStatus.Found:
      ratingUI.setRating(productType, rating, rating.link)
      return
    case RatingResultStatus.Uncertain:
      ratingUI.setUncertain(productType, rating.link)
      return
    default:
      ratingUI.setMessage(i18n.t(TranslationKeys.noMatch))
      return
  }
}

async function isProductFeatureEnabled(
  productType: ProductType
): Promise<boolean> {
  if (
    productType === ProductType.Wine &&
    !(await wineFeatureEnabled.getValue())
  ) {
    return false
  }
  if (
    productType === ProductType.Beer &&
    !(await beerFeatureEnabled.getValue())
  ) {
    return false
  }
  return true
}

async function tryInsertOnProductPage() {
  const isAddonEnabled = await featuresEnabled.getValue()
  if (!isAddonEnabled) return

  const productType = productParser.getProductType()
  if (
    fetchingRatingInProgress ||
    // Exclude uncertain product types as they cannot be reliably rated
    productType === ProductType.Uncertain ||
    !(await isProductFeatureEnabled(productType))
  ) {
    return
  }

  const productName = productParser.getProductName()
  if (!productName) {
    return
  }

  ratingUI.injectRatingContainer()
  if (productType == ProductType.Wine && !productParser.isBottle()) {
    ratingUI.setMessage(i18n.t(TranslationKeys.notOnBottle))
    return
  }

  await fetchAndDisplayRating(productName, productType)
}
