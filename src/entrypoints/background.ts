import browser from 'webextension-polyfill'

import { ProductType, type RatingRequest } from '@/@types/types'
import * as untappd from '@/services/integrations/untappd'
import * as vivino from '@/services/integrations/vivino'

export default defineBackground(() => {
  // This is the background script entry point
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
  const { productName, query } = message
  switch (query) {
    case ProductType.Beer:
      return await untappd.getRating(productName)
    case ProductType.Wine:
      return await vivino.getRating(productName)
  }
})
