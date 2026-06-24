import browser from 'webextension-polyfill'

import {
  ProductType,
  RatingRequest,
  RatingResponse,
  RatingResultStatus
} from '@/@types/types'

import { saveRating as cacheRating, tryGetRating } from './ratingsCache'

export async function fetchRating(
  productId: string,
  productName: string,
  type: ProductType
): Promise<RatingResponse> {
  try {
    const ratingRequest = { productId, productName, query: type }
    const cachedRating = await tryGetRating(ratingRequest)
    if (cachedRating) {
      return cachedRating
    }
    const response = await browser.runtime.sendMessage<
      RatingRequest,
      RatingResponse
    >(ratingRequest)

    if (response.status !== RatingResultStatus.NotFound) {
      await cacheRating(ratingRequest, response)
    }
    return response
  } catch {
    return { status: RatingResultStatus.NotFound } as RatingResponse
  }
}

const LIST_FETCH_DELAY_MS = 300

let listFetchQueue: Promise<undefined> = Promise.resolve(undefined)

export function enqueueListFetch(
  productId: string,
  productName: string,
  type: ProductType
): Promise<RatingResponse> {
  const task = listFetchQueue.then(
    () =>
      new Promise<RatingResponse>((resolve) => {
        setTimeout(() => {
          void fetchRating(productId, productName, type).then(resolve)
        }, LIST_FETCH_DELAY_MS)
      })
  )
  listFetchQueue = task.then(() => undefined)
  return task
}
