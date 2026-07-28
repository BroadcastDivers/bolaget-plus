import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing'

import {
  ProductType,
  RatingRequest,
  RatingResponse,
  RatingResultStatus
} from '@/@types/types'
import { saveRating } from '@/components/ratingsCache'
import {
  enqueueListFetch,
  resetListFetchQueue
} from '@/components/ratingService'

const request: RatingRequest = {
  includeImage: false,
  productId: '123',
  productName: 'Test Wine',
  query: ProductType.Wine
}

const rating: RatingResponse = {
  link: 'https://www.vivino.com/wines/1',
  name: 'Test Wine',
  rating: 4.2,
  status: RatingResultStatus.Found,
  votes: 10
}

describe('enqueueListFetch', () => {
  beforeEach(() => {
    fakeBrowser.reset()
    vi.restoreAllMocks()
    // The queue is module state shared by every test in this file; without
    // this, a case that leaves a task pending stalls each later case.
    resetListFetchQueue()
  })

  // The throttle exists to pace requests at the two rating sites; a cache hit
  // talks to neither, so making it wait behind the queue meant a revisited
  // list page trickled in one badge per tick.
  it('serves a cached rating without waiting for the throttle queue', async () => {
    await saveRating(request, rating)
    const sendMessage = vi.spyOn(fakeBrowser.runtime, 'sendMessage')

    // No timer is ever advanced below, so a cache hit routed through the
    // queue's setTimeout would never settle — which is the regression: a
    // fully-cached list page trickled in one badge per delay tick.
    vi.useFakeTimers()
    try {
      await expect(
        enqueueListFetch(
          request.productId,
          request.productName,
          ProductType.Wine
        )
      ).resolves.toEqual(rating)
    } finally {
      vi.useRealTimers()
    }

    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('falls through to the throttled fetch when nothing is cached', async () => {
    const sendMessage = vi
      .spyOn(fakeBrowser.runtime, 'sendMessage')
      .mockResolvedValue(rating)

    const result = await enqueueListFetch('456', 'Other Wine', ProductType.Wine)

    expect(result).toEqual(rating)
    expect(sendMessage).toHaveBeenCalledTimes(1)
    // List-page lookups never ask for label thumbnails.
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ includeImage: false, productId: '456' })
    )
  })

  // Checking the cache before claiming a queue slot would order the queue by
  // whichever storage read resolved first, so badges could fill in out of the
  // order their cards appear on the page.
  it('queues uncached cards in call order regardless of cache-read timing', async () => {
    const requested: string[] = []
    vi.spyOn(fakeBrowser.runtime, 'sendMessage').mockImplementation(
      (message: unknown) => {
        requested.push((message as RatingRequest).productId)
        return Promise.resolve(rating)
      }
    )

    // A cached card sits between two uncached ones: it must not consume a
    // queue slot, and it must not reorder the cards that do.
    await saveRating({ ...request, productId: 'b' }, rating)

    // Make the first card's cache read the slowest one. Claiming queue slots
    // only after the read resolves would put 'c' ahead of 'a'.
    const get = fakeBrowser.storage.local.get.bind(fakeBrowser.storage.local)
    vi.spyOn(fakeBrowser.storage.local, 'get').mockImplementation(
      async (keys) => {
        if (JSON.stringify(keys).includes('ratings:a-wine')) {
          await new Promise((resolve) => setTimeout(resolve, 50))
        }
        return get(keys)
      }
    )

    const results = await Promise.all([
      enqueueListFetch('a', 'Wine A', ProductType.Wine),
      enqueueListFetch('b', 'Test Wine', ProductType.Wine),
      enqueueListFetch('c', 'Wine C', ProductType.Wine)
    ])

    expect(results).toHaveLength(3)
    expect(requested).toEqual(['a', 'c'])
  })
})
