import { beforeEach, describe, expect, it, vi } from 'vitest'
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

const LAST_SWEEP_KEY = 'ratings-last-sweep'

// The sweep's own bookkeeping key is asserted separately; keeping it out here
// leaves the other assertions about cache entries only.
async function storedKeys(): Promise<string[]> {
  const items = await fakeBrowser.storage.local.get(null)
  return Object.keys(items)
    .filter((key) => key !== LAST_SWEEP_KEY)
    .sort()
}

describe('ratingsCache', () => {
  beforeEach(() => {
    fakeBrowser.reset()
    vi.restoreAllMocks()
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

  // saveRating's setItem/setMeta pair is not atomic, and neither half is
  // self-evicting: a value with no metadata is refused by tryGetRating without
  // being removed, and metadata with no value is never even looked at.
  it('sweeps a value entry whose metadata never landed', async () => {
    await fakeBrowser.storage.local.set({ 'ratings:777-wine': rating })

    await removeExpiredRatings()

    await expect(storedKeys()).resolves.toEqual([])
  })

  it('sweeps metadata left behind without its value', async () => {
    await fakeBrowser.storage.local.set({
      'ratings:777-wine$': { datetime: new Date().toISOString() }
    })

    await removeExpiredRatings()

    await expect(storedKeys()).resolves.toEqual([])
  })

  // saveRating runs in the content script while the sweep runs in the
  // background, so a scan can start after the value has landed but before its
  // metadata has. Collecting on that first sighting would throw away a rating
  // that was in the middle of being written.
  it('keeps a pair that was merely mid-write when the scan ran', async () => {
    await saveRating(request, rating)

    // Hide the metadata from the full-store scan only; the targeted re-read
    // that decides what to collect sees the finished pair, exactly as it would
    // in the real race.
    const get = fakeBrowser.storage.local.get.bind(fakeBrowser.storage.local)
    vi.spyOn(fakeBrowser.storage.local, 'get').mockImplementation(
      async (keys) => {
        const items = await get(keys)
        if (keys !== null) {
          return items
        }
        return Object.fromEntries(
          Object.entries(items).filter(([key]) => key !== 'ratings:123-wine$')
        )
      }
    )

    await removeExpiredRatings()
    // storedKeys reads the whole store too, so drop the mock before asserting.
    vi.restoreAllMocks()

    await expect(storedKeys()).resolves.toEqual([
      'ratings:123-wine',
      'ratings:123-wine$'
    ])
  })

  // Claiming the interval before doing the work would let a sweep that threw
  // partway suppress the next attempt for a full hour.
  it('retries after a sweep that failed instead of claiming the interval', async () => {
    await saveRating({ ...request, productId: '999' }, rating)
    await fakeBrowser.storage.local.set({
      'ratings:999-wine$': { datetime: TWO_DAYS_AGO }
    })

    vi.spyOn(fakeBrowser.storage.local, 'remove').mockRejectedValueOnce(
      new Error('storage unavailable')
    )
    await expect(removeExpiredRatings()).rejects.toThrow('storage unavailable')
    await expect(storedKeys()).resolves.toEqual([
      'ratings:999-wine',
      'ratings:999-wine$'
    ])

    // Immediately afterwards — well inside the hour — the sweep runs again.
    await removeExpiredRatings()

    await expect(storedKeys()).resolves.toEqual([])
  })

  // The MV3 service worker restarts constantly, and each sweep reads every
  // cached value — label images included — so it must not run per restart.
  it('sweeps at most once per interval, then again once it lapses', async () => {
    await saveRating({ ...request, productId: '999' }, rating)
    await fakeBrowser.storage.local.set({
      'ratings:999-wine$': { datetime: TWO_DAYS_AGO }
    })

    await removeExpiredRatings()
    await expect(storedKeys()).resolves.toEqual([])

    // An entry that expires just after a sweep waits for the next window.
    await saveRating(request, rating)
    await fakeBrowser.storage.local.set({
      'ratings:123-wine$': { datetime: TWO_DAYS_AGO }
    })

    await removeExpiredRatings()
    await expect(storedKeys()).resolves.toEqual([
      'ratings:123-wine',
      'ratings:123-wine$'
    ])

    // Backdating the marker stands in for the next browsing session.
    await fakeBrowser.storage.local.set({
      [LAST_SWEEP_KEY]: Date.now() - 2 * 60 * 60 * 1000
    })

    await removeExpiredRatings()
    await expect(storedKeys()).resolves.toEqual([])
  })
})
