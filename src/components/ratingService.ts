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
  type: ProductType,
  includeImage = false
): Promise<RatingResponse> {
  try {
    const ratingRequest = { includeImage, productId, productName, query: type }
    const cachedRating = await tryGetRating(ratingRequest)
    // An entry cached by a list page has no thumbnails; when the product
    // page asks for images, refetch instead of serving the imageless copy.
    if (cachedRating && !(includeImage && isMissingImages(cachedRating, type))) {
      return cachedRating
    }
    const response = await browser.runtime.sendMessage<
      RatingRequest,
      RatingResponse
    >(ratingRequest)

    if (response.status !== RatingResultStatus.NotFound && !response.transient) {
      await cacheRating(ratingRequest, response)
    }
    return response
  } catch {
    return { status: RatingResultStatus.NotFound } as RatingResponse
  }
}

function isMissingImages(rating: RatingResponse, type: ProductType): boolean {
  if (type !== ProductType.Wine) {
    return false
  }
  if (rating.status === RatingResultStatus.Found) {
    return !rating.imageDataUrl
  }
  return rating.alternatives?.some((a) => !a.imageDataUrl) ?? false
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
