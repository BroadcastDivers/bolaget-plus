import { RatingResponse } from '@/@types/types'
import { storage } from 'wxt/storage'

const CACHE_EXPIRATION_DAYS = 1

function calculateDaysDifference(date1: Date, date2: Date): number {
  const diffTime = date2.getTime() - date1.getTime()
  return diffTime / (1000 * 3600 * 24)
}

export async function saveRating(
  requestUrl: string,
  rating: RatingResponse
): Promise<void> {
  await Promise.all([
    storage.setItem(`local:ratings:${requestUrl}`, rating),
    storage.setMeta(`local:ratings:${requestUrl}`, {
      datetime: new Date().toISOString()
    })
  ])

  return
}

export async function tryGetRating(
  requestUrl: string
): Promise<RatingResponse | null> {
  const cachedRating = await storage.getItem<RatingResponse>(
    `local:ratings:${requestUrl}`
  )
  if (!cachedRating) {
    return null
  }

  const metadata = await storage.getMeta<{ datetime: string }>(
    `local:ratings:${requestUrl}`
  )
  if (!metadata) {
    return null
  }

  const cachedDate = new Date(metadata.datetime)
  const now = new Date()
  const diffDays = calculateDaysDifference(cachedDate, now)

  if (diffDays > CACHE_EXPIRATION_DAYS) {
    await storage.removeItem(`local:ratings:${requestUrl}`, {
      removeMeta: true
    })
    return null
  }

  return cachedRating
}
