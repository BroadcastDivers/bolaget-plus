import { afterEach, describe, expect, it, vi } from 'vitest'

import { BeerResponse, RatingResultStatus } from '@/@types/types'
import { fetchRatingFromUntappd, fetchRatingFromVivino } from '@/components/api'

const fetchMock = vi.fn<typeof fetch>()
vi.stubGlobal('fetch', fetchMock)

afterEach(() => {
  fetchMock.mockReset()
})

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body))
}

describe('fetchRatingFromVivino', () => {
  it('accepts a hit whose winery is confirmed by the query', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        hits: [
          {
            id: 1,
            name: 'Crianza',
            statistics: { ratings_average: 4.1, ratings_count: 1200 },
            vintages: [
              { id: 11, statistics: { ratings_count: 30 } },
              { id: 12, statistics: { ratings_count: 900 } }
            ],
            winery: { name: 'El Coto' }
          }
        ],
        nbHits: 100
      })
    )

    const result = await fetchRatingFromVivino('El Coto Crianza', false)

    expect(result.status).toBe(RatingResultStatus.Found)
    expect(result.name).toBe('El Coto Crianza')
    expect(result.rating).toBe(4.1)
    expect(result.votes).toBe(1200)
    // Links by the most-rated vintage, not the wine id.
    expect(result.link).toBe('https://www.vivino.com/wines/12')
  })

  it('accepts an exact name match when the title is distinctive', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        hits: [
          {
            id: 2,
            name: 'Contacto Loureiro',
            statistics: { ratings_average: 4.0, ratings_count: 500 },
            winery: { name: 'Anselmo Mendes' }
          }
        ],
        nbHits: 3
      })
    )

    const result = await fetchRatingFromVivino('Contacto Loureiro', false)

    expect(result.status).toBe(RatingResultStatus.Found)
    // No vintage data — falls back to the wine-id page.
    expect(result.link).toBe('https://www.vivino.com/w/2')
  })

  it('rejects an exact name match on a common style title', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        hits: [
          {
            id: 3,
            name: 'Prosecco Extra Dry',
            statistics: { ratings_average: 4.5, ratings_count: 9000 },
            winery: { name: 'Casa Bella' }
          }
        ],
        nbHits: 1714
      })
    )

    const result = await fetchRatingFromVivino('Prosecco Extra Dry', false)

    expect(result.status).toBe(RatingResultStatus.Uncertain)
    expect(result.transient).toBeUndefined()
    expect(result.link).toContain('vivino.com/search')
    expect(result.alternatives).toHaveLength(1)
  })

  it('rejects a near-namesake from an unconfirmed producer', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        hits: [
          {
            id: 4,
            name: 'R Riesling Organic',
            statistics: { ratings_average: 4.2, ratings_count: 800 },
            winery: { name: 'R Wines' }
          }
        ],
        nbHits: 49
      })
    )

    const result = await fetchRatingFromVivino('Riesling Organic', false)

    expect(result.status).toBe(RatingResultStatus.Uncertain)
  })

  it('ignores hidden hits', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        hits: [
          {
            hidden: true,
            id: 5,
            name: 'Hidden Wine',
            statistics: { ratings_average: 4.9, ratings_count: 10 },
            winery: { name: 'Hidden Winery' }
          }
        ],
        nbHits: 1
      })
    )

    const result = await fetchRatingFromVivino('Hidden Wine', false)

    expect(result.status).toBe(RatingResultStatus.Uncertain)
    expect(result.transient).toBeUndefined()
  })

  it('marks HTTP errors as transient so they are never cached', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 429 }))

    const result = await fetchRatingFromVivino('El Coto Crianza', false)

    expect(result.status).toBe(RatingResultStatus.Uncertain)
    expect(result.transient).toBe(true)
    expect(result.link).toContain('vivino.com/search')
  })

  it('marks network failures as transient', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))

    const result = await fetchRatingFromVivino('El Coto Crianza', false)

    expect(result.status).toBe(RatingResultStatus.Uncertain)
    expect(result.transient).toBe(true)
  })
})

describe('fetchRatingFromUntappd', () => {
  it('returns the best-matching beer', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        hits: [
          {
            beer_name: 'Pabst Blue Ribbon',
            beer_slug: 'pabst-brewing-company-pabst-blue-ribbon',
            bid: 3092,
            brewery_beer_name: 'Pabst Brewing Company Pabst Blue Ribbon',
            brewery_name: 'Pabst Brewing Company',
            rating_count: 500000,
            rating_score: 2.9
          }
        ]
      })
    )

    const result = await fetchRatingFromUntappd('Pabst Blue Ribbon')

    expect(result.status).toBe(RatingResultStatus.Found)
    expect(result.rating).toBe(2.9)
    expect(result.votes).toBe(500000)
    expect(result.link).toBe(
      'https://untappd.com/b/pabst-brewing-company-pabst-blue-ribbon/3092'
    )
    expect((result as BeerResponse).brewery).toBe('Pabst Brewing Company')
  })

  it('normalizes a missing score to 0 for the N/A rendering', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        hits: [
          {
            beer_name: 'Rare Beer',
            beer_slug: 'rare-beer',
            bid: 1,
            brewery_beer_name: 'Tiny Brewery Rare Beer',
            brewery_name: 'Tiny Brewery',
            rating_count: null,
            rating_score: null
          }
        ]
      })
    )

    const result = await fetchRatingFromUntappd('Rare Beer')

    expect(result.status).toBe(RatingResultStatus.Found)
    expect(result.rating).toBe(0)
    expect(result.votes).toBe(0)
  })

  it('returns uncertain with a search link when nothing matches well', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        hits: [
          {
            beer_name: 'Zzz Qqq',
            beer_slug: 'zzz-qqq',
            bid: 2,
            brewery_beer_name: 'Www Zzz Qqq',
            brewery_name: 'Www',
            rating_count: 5,
            rating_score: 3.0
          }
        ]
      })
    )

    const result = await fetchRatingFromUntappd('Mellanmust Julebrygd')

    expect(result.status).toBe(RatingResultStatus.Uncertain)
    expect(result.link).toContain('untappd.com/search')
    expect(result.alternatives).toHaveLength(1)
  })

  it('returns not found for an empty result set', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ hits: [] }))

    const result = await fetchRatingFromUntappd('Nonexistent Beer')

    expect(result.status).toBe(RatingResultStatus.NotFound)
  })

  it('marks HTTP errors as transient so they are never cached', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 429 }))

    const result = await fetchRatingFromUntappd('Pabst Blue Ribbon')

    expect(result.status).toBe(RatingResultStatus.Uncertain)
    expect(result.transient).toBe(true)
    expect(result.link).toContain('untappd.com/search')
  })

  it('marks network failures as transient', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))

    const result = await fetchRatingFromUntappd('Pabst Blue Ribbon')

    expect(result.status).toBe(RatingResultStatus.Uncertain)
    expect(result.transient).toBe(true)
  })
})
