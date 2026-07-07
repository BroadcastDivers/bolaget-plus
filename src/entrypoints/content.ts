import sentinel from 'sentinel-js'

import {
  ProductType,
  type RatingResponse,
  RatingResultStatus
} from '@/@types/types'
import * as domUtils from '@/components/domUtils'
import * as productUtils from '@/components/productUtils'
import { fetchRating } from '@/components/ratingService'
import { wineFeatureEnabled } from '@/components/settings'

export default defineContentScript({
  main() {
    //eslint-disable-next-line @typescript-eslint/no-misused-promises
    sentinel.on('h1', tryInsertOnProductPage)
    void tryInsertOnProductPage()
  },
  matches: ['*://*.systembolaget.se/*']
})

// The product whose rating is currently being fetched. Used to dedupe
// repeated sentinel callbacks for the same page and to discard responses
// that resolve after the user has navigated to another product.
let activeRequest: null | { productName: string } = null

async function featureEnabled(productType: ProductType): Promise<boolean> {
  if (
    (productType === ProductType.Wine &&
      !(await wineFeatureEnabled.getValue())) ||
    (productType === ProductType.Beer && !(await beerFeatureEnabled.getValue()))
  ) {
    return false
  }
  return true
}

function handleRating(productType: ProductType, rating: RatingResponse) {
  switch (rating.status) {
    case RatingResultStatus.Found:
      domUtils.setRating(productType, rating, rating.link)
      return
    case RatingResultStatus.Uncertain:
      domUtils.setUncertain(productType, rating.link)
      return
    default:
      domUtils.setMessage(i18n.t('noMatch'))
      return
  }
}

async function tryInsertOnProductPage() {
  if (!(await featuresEnabled.getValue())) return

  const productType = productUtils.getProductType()
  if (
    productType === ProductType.Uncertain ||
    !(await featureEnabled(productType))
  ) {
    return
  }

  domUtils.injectRatingContainer()
  if (productType == ProductType.Wine && !productUtils.isBottle()) {
    domUtils.setMessage(i18n.t('notOnBottle'))
    return
  }

  const productName = productUtils.getProductName()
  if (!productName || activeRequest?.productName === productName) {
    return
  }

  const request = { productName }
  activeRequest = request
  try {
    domUtils.showLoadingSpinner()

    const rating = await fetchRating(productName, productType)
    if (activeRequest !== request) return
    handleRating(productType, rating)
  } catch {
    if (activeRequest === request) {
      domUtils.setMessage(i18n.t('noMatch'))
    }
  } finally {
    if (activeRequest === request) {
      activeRequest = null
    }
  }
}
