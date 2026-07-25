import { storage } from '@wxt-dev/storage'
import browser from 'webextension-polyfill'

import { RatingRequest, RatingResponse } from '@/@types/types'

const CACHE_EXPIRATION_DAYS = 1

const RATINGS_KEY_PREFIX = 'ratings:'
// @wxt-dev/storage stores an item's metadata under `<key>$`.
const META_KEY_SUFFIX = '$'

// tryGetRating only evicts an entry when its own product is revisited after
// expiry; without a sweep, entries for products never seen again pile up
// forever — and since responses carry base64 label images they would
// eventually exhaust the storage.local quota. Run on background startup.
export async function removeExpiredRatings(): Promise<void> {
  const allItems = await browser.storage.local.get(null)
  const now = new Date()
  const expiredKeys: string[] = []

  for (const [key, value] of Object.entries(allItems)) {
    if (!key.startsWith(RATINGS_KEY_PREFIX) || !key.endsWith(META_KEY_SUFFIX)) {
      continue
    }
    const datetime =
      typeof value === 'object' &&
      value !== null &&
      'datetime' in value &&
      typeof value.datetime === 'string'
        ? value.datetime
        : null
    const expired =
      !datetime ||
      calculateDaysDifference(new Date(datetime), now) > CACHE_EXPIRATION_DAYS
    if (expired) {
      expiredKeys.push(key.slice(0, -META_KEY_SUFFIX.length), key)
    }
  }

  if (expiredKeys.length > 0) {
    await browser.storage.local.remove(expiredKeys)
  }
}

export async function saveRating(
  ratingRequest: RatingRequest,
  rating: RatingResponse
): Promise<void> {
  const key = generateCacheKey(ratingRequest)
  await Promise.all([
    storage.setItem(key, rating),
    storage.setMeta(key, {
      datetime: new Date().toISOString()
    })
  ])

  return
}

export async function tryGetRating(
  ratingRequest: RatingRequest
): Promise<null | RatingResponse> {
  const key = generateCacheKey(ratingRequest)
  const [cachedRating, metadata] = await Promise.all([
    storage.getItem<RatingResponse>(key),
    storage.getMeta<{ datetime: string }>(key)
  ])
  if (!cachedRating || !metadata.datetime) {
    return null
  }
  const diffDays = calculateDaysDifference(
    new Date(metadata.datetime),
    new Date()
  )

  if (diffDays > CACHE_EXPIRATION_DAYS) {
    await storage.removeItem(key, {
      removeMeta: true
    })
    return null
  }

  return cachedRating
}

function calculateDaysDifference(date1: Date, date2: Date): number {
  const diffTime = date2.getTime() - date1.getTime()
  return diffTime / (1000 * 3600 * 24)
}

function generateCacheKey(ratingRequest: RatingRequest): `local:${string}` {
  return `local:ratings:${ratingRequest.productId}-${ratingRequest.query}`
}
