import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing'

import {
  ProductType,
  RatingRequest,
  RatingResponse,
  RatingResultStatus
} from '@/@types/types'
import { saveRating } from '@/components/ratingsCache'
import { enqueueListFetch } from '@/components/ratingService'

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
})
