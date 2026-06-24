import sentinel from 'sentinel-js'

import {
  ProductType,
  type RatingResponse,
  RatingResultStatus
} from '@/@types/types'
import * as domUtils from '@/components/domUtils'
import * as productUtils from '@/components/productUtils'
import { enqueueListFetch, fetchRating } from '@/components/ratingService'
import { wineFeatureEnabled } from '@/components/settings'

export default defineContentScript({
  main() {
    const listCardObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          listCardObserver.unobserve(entry.target)
          void handleListCard(entry.target)
        }
      },
      { rootMargin: '200px' }
    )

    //eslint-disable-next-line @typescript-eslint/no-misused-promises
    sentinel.on('h1', tryInsertOnProdcutPage)
    void tryInsertOnProdcutPage()
    sentinel.on('a[id^="tile:"]', (card) => {
      listCardObserver.observe(card)
    })
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

async function handleListCard(card: Element) {
  if (!(await featuresEnabled.getValue())) return
  const productType = productUtils.getCardProductType(card)
  if (productType === ProductType.Uncertain) return
  if (
    productType === ProductType.Wine &&
    !(await wineFeatureEnabled.getValue())
  )
    return
  if (
    productType === ProductType.Beer &&
    !(await beerFeatureEnabled.getValue())
  )
    return

  const productId = productUtils.getCardProductId(card)
  const name = productUtils.getCardName(card)
  if (!productId || !name) return

  const spinner = domUtils.injectCardSpinner(card)
  if (!spinner) return

  const rating = await enqueueListFetch(productId, name, productType)
  domUtils.replaceCardSpinner(spinner, productType, rating)
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

  const productId = productUtils.getProductId()
  const productName = productUtils.getProductName()
  if (!productId || !productName) {
    return
  }

  try {
    fetchingRatingInProgress = true
    domUtils.showLoadingSpinner()

    const rating = await fetchRating(productId, productName, productType)
    handleRating(productType, rating)
  } catch {
    domUtils.setMessage(i18n.t('noMatch'))
  } finally {
    fetchingRatingInProgress = false
  }
}
