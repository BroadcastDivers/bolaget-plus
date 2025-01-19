import browser from 'webextension-polyfill'
import { type GetRating, ProductType } from '@/@types/types'
import { fetchRatingFromVivino } from '@/components/api'

export default defineBackground(() => {
  console.log('Running with id:', { id: browser.runtime.id })
})

function isGetRatingMessage(message: unknown): message is GetRating {
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
  const { query, productName } = message
  switch (query) {
    case ProductType.Wine:
      return await fetchRatingFromVivino(productName)
    case ProductType.Beer:
      return await fetchRatingFromUntappd(productName)
  }
})
