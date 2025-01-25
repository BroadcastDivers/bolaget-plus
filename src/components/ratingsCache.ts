import { RatingRequest, RatingResponse } from '@/@types/types'
import { storage } from 'wxt/storage'

const CACHE_EXPIRATION_DAYS = 1

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
  const cachedRating = await storage.getItem<RatingResponse>(key)
  const metadata = await storage.getMeta<{ datetime: string }>(key)
  if (!cachedRating || !metadata) {
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
  return `local:ratings:${ratingRequest.productName}-${ratingRequest.query}`
}
