import {
  ProductType,
  type RatingResponse,
  RatingResultStatus
} from '@/@types/types'
import { fetchRating } from '@/components/api'
import * as domUtils from '@/components/domUtils'
import * as productUtils from '@/components/productUtils'
import { wineFeatureEnabled } from '@/components/settings'
import sentinel from 'sentinel-js'

export default defineContentScript({
  main() {
    //eslint-disable-next-line @typescript-eslint/no-misused-promises
    sentinel.on('h1', tryInsertOnProdcutPage)
  },
  matches: ['*://*.systembolaget.se/*']
})

let fetchingRatingInProgress = false

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

async function tryInsertOnProdcutPage() {
  if (!(await featuresEnabled.getValue())) return

  const productType = productUtils.getProductType()
  if (
    fetchingRatingInProgress ||
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
  if (!productName) {
    return
  }

  try {
    fetchingRatingInProgress = true
    domUtils.showLoadingSpinner()

    const rating = await fetchRating(productName, productType)
    handleRating(productType, rating)
  } catch {
    domUtils.setMessage(i18n.t('noMatch'))
  } finally {
    fetchingRatingInProgress = false
  }
}
