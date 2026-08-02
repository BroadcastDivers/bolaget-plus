import { expect, test } from '@playwright/test'

import { RatingResultStatus, UntappdSearchConfig } from '../src/@types/types'
import {
  fetchRatingFromUntappd,
  fetchRatingFromVivino,
  fetchUntappdSearchConfig
} from '../src/components/api'

// These tests query Vivino and Untappd for real, so they fail whenever those
// sites change, rate-limit the runner, or are simply down. That is the point —
// but it also means they are not a signal about this repository, so they live
// in the nightly smoke run rather than in CI. The mocked counterparts that do
// gate CI are in api-matching.spec.ts.

// The credentials Untappd's search page is shipping right now. Reading them
// live is the point: if their markup changes, these tests fail instead of the
// extension silently falling back to a pinned key that may be rotated out.
const liveConfig: UntappdSearchConfig = {
  appId: '9WBO4RQ3HO',
  searchKey: '1d347324d67ec472bb7132c66aead485'
}

test.describe('API Integration Tests', () => {
  test('fetchUntappdSearchConfig reads live credentials from untappd.com', async () => {
    const config = await fetchUntappdSearchConfig()

    expect(config.appId).toMatch(/^[0-9A-Z]{10}$/)
    expect(config.searchKey).toMatch(/^[0-9a-f]{32}$/)
    // Copy them onto the shared object so the lookups below use whatever is
    // live, not a hardcoded pair.
    Object.assign(liveConfig, config)
  })

  test('fetchRatingFromVivino returns data for valid query', async () => {
    const result = await fetchRatingFromVivino('Bread & Butter')

    expect(result).not.toBeNull()
    expect(result.status).toBe(RatingResultStatus.Found)
    expect(result.rating).toBeGreaterThan(0)
    expect(result.votes).toBeGreaterThan(0)
    expect(result.link).toContain('vivino.com')
  })

  // Regression: the explore endpoint missed even top-selling wines (its index
  // only covers marketplace listings). The Algolia index must find them.
  test('fetchRatingFromVivino finds a top-selling wine', async () => {
    const result = await fetchRatingFromVivino(
      'Casillero del Diablo Cabernet Sauvignon',
      false
    )

    expect(result.status).toBe(RatingResultStatus.Found)
    expect(result.votes).toBeGreaterThan(10000)
  })

  test('fetchRatingFromUntappd returns data for valid query', async () => {
    const result = await fetchRatingFromUntappd('Pabst Blue Ribbon', liveConfig)

    expect(result).not.toBeNull()
    expect(result.status).toBe(RatingResultStatus.Found)
    expect(result.rating).toBeGreaterThan(0)
    expect(result.votes).toBeGreaterThan(0)
    expect(result.link).toContain('untappd.com')
  })

  test('fetchRatingFromUntappd returns data for a cider query', async () => {
    const result = await fetchRatingFromUntappd('Rekorderlig Päron', liveConfig)

    expect(result).not.toBeNull()
    expect(result.status).toBe(RatingResultStatus.Found)
    expect(result.rating).toBeGreaterThan(0)
    expect(result.votes).toBeGreaterThan(0)
    expect(result.link).toContain('untappd.com')
  })
})
