import { type RatingRequest, ProductType } from '@/@types/types'
import { fetchRatingFromVivino, fetchRatingFromUntappd } from '@/components/api'
import browser from 'webextension-polyfill'

export default defineBackground(() => {
  // console.log('Running with id:', { id: browser.runtime.id })
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
      return await fetchRatingFromUntappd(productName)
    case ProductType.Wine:
      return await fetchRatingFromVivino(productName)
  }
})
