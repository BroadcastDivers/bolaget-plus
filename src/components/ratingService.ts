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
    if (
      cachedRating &&
      !(includeImage && isMissingImages(cachedRating, type))
    ) {
      return cachedRating
    }
    const response = await browser.runtime.sendMessage<
      RatingRequest,
      RatingResponse
    >(ratingRequest)

    if (
      response.status !== RatingResultStatus.NotFound &&
      !response.transient
    ) {
      await cacheRating(ratingRequest, response)
    }
    return response
  } catch {
    return {
      link: null,
      name: null,
      rating: 0,
      status: RatingResultStatus.NotFound,
      votes: 0
    }
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
  // Cached ratings render immediately — only real network fetches go through
  // the throttled queue, so a revisited list page fills in instantly instead
  // of trickling one badge per delay tick.
  const cached = tryGetRating({
    includeImage: false,
    productId,
    productName,
    query: type
  }).catch(() => null)

  // Claim this card's place in the queue synchronously, in call order, so the
  // badges that do need the network still fill in top-down. Awaiting the cache
  // read before claiming would order the queue by whichever storage read
  // happened to resolve first.
  const previous = listFetchQueue

  const task = (async (): Promise<RatingResponse> => {
    const hit = await cached
    if (hit) {
      return hit
    }
    await previous
    await new Promise((resolve) => setTimeout(resolve, LIST_FETCH_DELAY_MS))
    return fetchRating(productId, productName, type)
  })()

  // A cache hit talks to neither rating site, so it hands its slot straight to
  // the next caller instead of making it wait out a delay tick.
  listFetchQueue = (async () => {
    if (await cached) {
      await previous
    } else {
      await task.catch(() => undefined)
    }
    return undefined
  })()

  return task
}

// The queue is module state that outlives any single page, so tests have to be
// able to put it back to its initial value between cases; otherwise one test
// leaving a task pending stalls every test that queues after it.
export function resetListFetchQueue(): void {
  listFetchQueue = Promise.resolve(undefined)
}
