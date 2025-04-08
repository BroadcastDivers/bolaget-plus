import {
  ProductType,
  RatingRequest,
  RatingResponse,
  RatingResultStatus
} from '@/@types/types'
import browser from 'webextension-polyfill'

import { saveRating as cacheRating, tryGetRating } from './ratingsCache'

export async function fetchRating(
  productName: string,
  type: ProductType
): Promise<RatingResponse> {
  try {
    const ratingRequest = { productName, query: type }
    const cachedRating = await tryGetRating(ratingRequest)
    if (cachedRating) {
      return cachedRating
    }
    const response = await browser.runtime.sendMessage<
      RatingRequest,
      RatingResponse
    >(ratingRequest)

    await cacheRating(ratingRequest, response)
    return response
  } catch {
    return { status: RatingResultStatus.NotFound } as RatingResponse
  }
}
