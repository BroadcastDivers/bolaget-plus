import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing'

import {
  ProductType,
  RatingRequest,
  RatingResponse,
  RatingResultStatus
} from '@/@types/types'
import {
  removeExpiredRatings,
  saveRating,
  tryGetRating
} from '@/components/ratingsCache'

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

const TWO_DAYS_AGO = new Date(
  Date.now() - 2 * 24 * 60 * 60 * 1000
).toISOString()

async function storedKeys(): Promise<string[]> {
  const items = await fakeBrowser.storage.local.get(null)
  return Object.keys(items).sort()
}

describe('ratingsCache', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('round-trips a saved rating', async () => {
    await saveRating(request, rating)

    await expect(tryGetRating(request)).resolves.toEqual(rating)
  })

  it('evicts an expired entry on read', async () => {
    await saveRating(request, rating)
    await fakeBrowser.storage.local.set({
      'ratings:123-wine$': { datetime: TWO_DAYS_AGO }
    })

    await expect(tryGetRating(request)).resolves.toBeNull()
    await expect(storedKeys()).resolves.toEqual([])
  })

  it('sweeps expired entries for products never revisited', async () => {
    await saveRating(request, rating)
    await saveRating({ ...request, productId: '999' }, rating)
    await fakeBrowser.storage.local.set({
      'ratings:999-wine$': { datetime: TWO_DAYS_AGO }
    })

    await removeExpiredRatings()

    await expect(storedKeys()).resolves.toEqual([
      'ratings:123-wine',
      'ratings:123-wine$'
    ])
  })

  it('sweeps entries whose metadata is missing a timestamp', async () => {
    await fakeBrowser.storage.local.set({
      'ratings:555-beer': rating,
      'ratings:555-beer$': {}
    })

    await removeExpiredRatings()

    await expect(storedKeys()).resolves.toEqual([])
  })

  it('leaves fresh entries and unrelated keys alone', async () => {
    await saveRating(request, rating)
    await fakeBrowser.storage.local.set({ unrelated: 'value' })

    await removeExpiredRatings()

    await expect(storedKeys()).resolves.toEqual([
      'ratings:123-wine',
      'ratings:123-wine$',
      'unrelated'
    ])
  })
})
