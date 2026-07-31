import { storage } from '@wxt-dev/storage'

import { UntappdSearchConfig } from '@/@types/types'

import { fetchUntappdSearchConfig } from './api'

// Untappd rotates these rarely, so a week between reads is plenty; a key that
// is rejected before then invalidates the entry on the spot (see below).
const CACHE_EXPIRATION_DAYS = 7

const CACHE_KEY = 'local:untappdSearchConfig'

export async function getSearchConfig(): Promise<UntappdSearchConfig> {
  const cached = await tryGetSearchConfig()
  if (cached) {
    return cached
  }

  const config = await fetchUntappdSearchConfig()
  await Promise.all([
    storage.setItem(CACHE_KEY, config),
    storage.setMeta(CACHE_KEY, { datetime: new Date().toISOString() })
  ])
  return config
}

// Called when a lookup comes back unauthorized, so the next request re-reads
// untappd.com instead of retrying a key that has since been rotated out.
export async function invalidateSearchConfig(): Promise<void> {
  await storage.removeItem(CACHE_KEY, { removeMeta: true })
}

async function tryGetSearchConfig(): Promise<null | UntappdSearchConfig> {
  const [config, metadata] = await Promise.all([
    storage.getItem<UntappdSearchConfig>(CACHE_KEY),
    storage.getMeta<{ datetime: string }>(CACHE_KEY)
  ])
  if (!config || !metadata.datetime) {
    return null
  }

  const ageDays =
    (Date.now() - new Date(metadata.datetime).getTime()) / (1000 * 3600 * 24)
  if (ageDays > CACHE_EXPIRATION_DAYS) {
    await invalidateSearchConfig()
    return null
  }

  return config
}
