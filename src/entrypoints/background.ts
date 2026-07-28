import browser from 'webextension-polyfill'

import { ProductType, type RatingRequest } from '@/@types/types'
import { fetchRatingFromUntappd, fetchRatingFromVivino } from '@/components/api'
import { removeExpiredRatings } from '@/components/ratingsCache'

const SWEEP_ALARM_NAME = 'ratings-cache-sweep'
const SWEEP_ALARM_PERIOD_MINUTES = 60

export default defineBackground(() => {
  // Sweep once at startup, then on a repeating alarm. The startup call alone
  // would be enough on Chrome, where the MV3 service worker restarts on nearly
  // every message — but the Firefox build is MV2 with a persistent background
  // page, so this callback runs once per browser session and a browser left
  // open for days would never sweep again. removeExpiredRatings throttles
  // itself, so the two triggers can't compound.
  void removeExpiredRatings().catch(() => undefined)

  // Only create the alarm when it isn't already scheduled: create() replaces
  // an existing alarm of the same name and restarts its countdown, so calling
  // it on every service-worker start would keep pushing the next firing out of
  // reach on Chrome.
  void (async () => {
    if (await browser.alarms.get(SWEEP_ALARM_NAME)) return
    await browser.alarms.create(SWEEP_ALARM_NAME, {
      periodInMinutes: SWEEP_ALARM_PERIOD_MINUTES
    })
  })().catch(() => undefined)

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== SWEEP_ALARM_NAME) return
    void removeExpiredRatings().catch(() => undefined)
  })
})

function isGetRatingMessage(message: unknown): message is RatingRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    'productName' in message &&
    'query' in message
  )
}

browser.runtime.onMessage.addListener(async (message: unknown) => {
  if (!isGetRatingMessage(message)) {
    return
  }
  const { includeImage, productName, query } = message
  switch (query) {
    case ProductType.Beer:
    case ProductType.Cider:
      return await fetchRatingFromUntappd(productName)
    case ProductType.Wine:
      return await fetchRatingFromVivino(productName, includeImage ?? true)
  }
})
