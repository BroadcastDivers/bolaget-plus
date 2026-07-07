import { storage } from '@wxt-dev/storage'

export const featuresEnabled = storage.defineItem<boolean>(
  'sync:featuresEnabled',
  {
    fallback: true
  }
)

export const wineFeatureEnabled = storage.defineItem<boolean>(
  'sync:wineFeatureEnabled',
  {
    fallback: true
  }
)

export const beerFeatureEnabled = storage.defineItem<boolean>(
  'sync:beerFeatureEnabled',
  {
    fallback: true
  }
)

export const ciderFeatureEnabled = storage.defineItem<boolean>(
  'sync:ciderFeatureEnabled',
  {
    fallback: true
  }
)
