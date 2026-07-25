import browser from 'webextension-polyfill'

import { ProductType, type RatingRequest } from '@/@types/types'
import { fetchRatingFromUntappd, fetchRatingFromVivino } from '@/components/api'
import { removeExpiredRatings } from '@/components/ratingsCache'

export default defineBackground(() => {
  // The MV3 service worker starts on browser launch and on events, so this
  // sweep runs often enough to keep expired entries from accumulating.
  void removeExpiredRatings().catch(() => undefined)
})

function isGetRatingMessage(message: unknown): message is RatingRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    'productName' in message &&
    'query' in message
  )
}

browser.runtime.onMessage.addListener(async (message: unknown) => {
  if (!isGetRatingMessage(message)) {
    return
  }
  const { includeImage, productName, query } = message
  switch (query) {
    case ProductType.Beer:
    case ProductType.Cider:
      return await fetchRatingFromUntappd(productName)
    case ProductType.Wine:
      return await fetchRatingFromVivino(productName, includeImage ?? true)
  }
})
