import { expect, test } from '@playwright/test'

import { RatingResultStatus } from '../src/@types/types'
import {
  fetchRatingFromUntappd,
  fetchRatingFromVivino
} from '../src/components/api'

test.describe('API Integration Tests', () => {
  test('fetchRatingFromVivino returns data for valid query', async () => {
    const result = await fetchRatingFromVivino('Barrel Select Malbec')

    expect(result).not.toBeNull()
    expect(result.status).toBe(RatingResultStatus.Found)
    expect(result.rating).toBeGreaterThan(0)
    expect(result.votes).toBeGreaterThan(0)
    expect(result.link).toContain('vivino.com')
  })

  test('fetchRatingFromUntappd returns data for valid query', async () => {
    const result = await fetchRatingFromUntappd('Pabst Blue Ribbon')

    expect(result).not.toBeNull()
    expect(result.status).toBe(RatingResultStatus.Found)
    expect(result.rating).toBeGreaterThan(0)
    expect(result.votes).toBeGreaterThan(0)
    expect(result.link).toContain('untappd.com')
  })
})
