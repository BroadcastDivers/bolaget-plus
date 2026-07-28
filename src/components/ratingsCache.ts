import { storage } from '@wxt-dev/storage'
import browser from 'webextension-polyfill'

import { RatingRequest, RatingResponse } from '@/@types/types'

const CACHE_EXPIRATION_DAYS = 1

const RATINGS_KEY_PREFIX = 'ratings:'
// @wxt-dev/storage stores an item's metadata under `<key>$`.
const META_KEY_SUFFIX = '$'
// The MV3 service worker restarts on every message after a short idle, so an
// unguarded sweep would re-read the whole cache — base64 label images included
// — many times per browsing session. Hourly is often enough for a cache that
// expires daily.
const SWEEP_INTERVAL_MS = 60 * 60 * 1000
// Deliberately outside RATINGS_KEY_PREFIX so the sweep never evicts its own
// bookkeeping.
const LAST_SWEEP_KEY = 'local:ratings-last-sweep'

// tryGetRating only evicts an entry when its own product is revisited after
// expiry; without a sweep, entries for products never seen again pile up
// forever — and since responses carry base64 label images they would
// eventually exhaust the storage.local quota. Run on background startup and
// on an hourly alarm.
export async function removeExpiredRatings(): Promise<void> {
  const startedAt = Date.now()
  const lastSweep = await storage.getItem<number>(LAST_SWEEP_KEY)
  if (lastSweep !== null && startedAt - lastSweep < SWEEP_INTERVAL_MS) {
    return
  }

  const { keys, metadata } = await readCacheIndex()
  const present = new Set(keys)
  const now = new Date()
  const expiredKeys: string[] = []
  // Half-written pairs are only dead weight if they are *still* half-written
  // once the scan is over — saveRating's two writes land a moment apart, so a
  // scan can start between them and see a torn pair that is about to be whole.
  const halfWritten: string[] = []

  for (const key of keys) {
    if (!key.startsWith(RATINGS_KEY_PREFIX)) {
      continue
    }
    if (!key.endsWith(META_KEY_SUFFIX)) {
      // saveRating's two writes are not atomic, so a terminated service worker
      // can leave a value with no metadata. tryGetRating rejects such an entry
      // without evicting it, so it would otherwise never expire.
      if (!present.has(`${key}${META_KEY_SUFFIX}`)) {
        halfWritten.push(key)
      }
      continue
    }
    const valueKey = key.slice(0, -META_KEY_SUFFIX.length)
    if (!present.has(valueKey)) {
      // The mirror image: metadata whose value is gone is dead weight.
      halfWritten.push(key)
      continue
    }
    const value = metadata[key]
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
      expiredKeys.push(valueKey, key)
    }
  }

  expiredKeys.push(...(await stillHalfWritten(halfWritten)))

  if (expiredKeys.length > 0) {
    await browser.storage.local.remove(expiredKeys)
  }
  // Written only once the sweep has actually finished: claiming the hour up
  // front would let a sweep that died partway — terminated service worker,
  // storage error — suppress the next attempt for an hour despite having
  // collected nothing.
  await storage.setItem(LAST_SWEEP_KEY, startedAt)
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

// The sweep only needs key names and the `datetime` on each metadata entry —
// never the cached responses themselves, which carry base64 label images.
// Chrome 130+ can list keys without reading values; elsewhere the whole store
// still has to be read, so this stays a fallback rather than the only path.
async function readCacheIndex(): Promise<{
  keys: string[]
  metadata: Record<string, unknown>
}> {
  const local: {
    getKeys?: () => Promise<string[]>
  } = browser.storage.local

  if (typeof local.getKeys !== 'function') {
    const allItems = await browser.storage.local.get(null)
    return { keys: Object.keys(allItems), metadata: allItems }
  }

  const keys = await local.getKeys()
  const metaKeys = keys.filter(
    (key) => key.startsWith(RATINGS_KEY_PREFIX) && key.endsWith(META_KEY_SUFFIX)
  )
  const metadata =
    metaKeys.length > 0 ? await browser.storage.local.get(metaKeys) : {}
  return { keys, metadata }
}

// Re-reads the counterpart of every half-written pair the scan turned up. A
// pair that was merely mid-write when the scan started is whole by now and is
// dropped from the list; what is left was genuinely abandoned by an
// interrupted write and can be collected.
async function stillHalfWritten(candidates: string[]): Promise<string[]> {
  if (candidates.length === 0) {
    return []
  }
  const counterpartOf = (key: string): string =>
    key.endsWith(META_KEY_SUFFIX)
      ? key.slice(0, -META_KEY_SUFFIX.length)
      : `${key}${META_KEY_SUFFIX}`

  const fresh = await browser.storage.local.get([
    ...candidates,
    ...candidates.map(counterpartOf)
  ])
  // Asking for an absent key can yield an own property set to undefined rather
  // than no property at all, so presence has to be judged on the value.
  const has = (key: string): boolean =>
    Object.hasOwn(fresh, key) && fresh[key] !== undefined

  return candidates.filter((key) => has(key) && !has(counterpartOf(key)))
}
