import sentinel from 'sentinel-js'
import { loadSettingAsync } from './storage'
import * as domUtils from './domUtils'
import * as productUtils from './productUtils'
import { fetchVivinoRating } from './api'
import { translations } from './translations'
import { VivinoResultStatus } from './types'

let fetchingRatingInProgress: boolean = false

;(async () => {
  if ((await loadSettingAsync('enabled')) == false) return

  const winePageSelector = 'h1'
  sentinel.on(winePageSelector, tryInsertOnProdcutPage)
})()

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
async function tryInsertOnProdcutPage(_: any) {
  if (fetchingRatingInProgress ) {
    return
  }

  // TODO
  if (location.href.includes('/sortiment/vin/')) {
    domUtils.injectRatingContainers()
    return
  }

  if (!location.href.includes('/produkt/vin/')) {
    return
  }

  domUtils.injectRatingContainer()
  if (!productUtils.isBottle()) {
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
    const response = await fetchVivinoRating(productName)
    if (response?.status === VivinoResultStatus.Found) {
      domUtils.setWineRating(response.rating, response.votes, response.link)
    } else if (response?.status === VivinoResultStatus.Uncertain) {
      domUtils.setUncertain(response.link)
    } else {
      domUtils.setMessage(translations.noMatch)
    }
  } catch (error) {
    console.error(`Error fetching rating for ${productName}:`, error)
  } finally {
    fetchingRatingInProgress = false
  }
}
