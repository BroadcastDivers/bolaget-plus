import stringSimilarity from 'string-similarity'

import {
  BeerResponse,
  RatingResponse,
  RatingResultStatus,
  UntappdHit,
  UntappdSearchJSON,
  VivinoMatch,
  VivinoResponseJSON
} from '@/@types/types'

// Untappd's search page renders results client-side via Algolia; these are the
// public search-only credentials it ships to anonymous visitors.
const UNTAPPD_ALGOLIA_APP_ID = '9WBO4RQ3HO'
const UNTAPPD_ALGOLIA_SEARCH_KEY = '1d347324d67ec472bb7132c66aead485'

export async function fetchRatingFromUntappd(
  productName: string
): Promise<RatingResponse> {
  const url = `https://${UNTAPPD_ALGOLIA_APP_ID.toLowerCase()}-dsn.algolia.net/1/indexes/beer/query`
  const searchFallbackUrl = `https://untappd.com/search?q=${encodeURIComponent(
    productName
  )}&type=beer&sort=all`

  try {
    const response = await fetch(url, {
      body: JSON.stringify({
        params: new URLSearchParams({
          hitsPerPage: '5',
          query: productName
        }).toString()
      }),
      headers: {
        'Content-Type': 'application/json',
        'X-Algolia-API-Key': UNTAPPD_ALGOLIA_SEARCH_KEY,
        'X-Algolia-Application-Id': UNTAPPD_ALGOLIA_APP_ID
      },
      method: 'POST'
    })

    if (!response.ok) {
      return { status: RatingResultStatus.NotFound } as RatingResponse
    }

    const data = (await response.json()) as UntappdSearchJSON
    const hits = data.hits ?? []

    if (hits.length === 0) {
      return { status: RatingResultStatus.NotFound } as RatingResponse
    }

    type ScoredBeer = BeerResponse & { similarityRate: number }

    const bestMatch = hits.reduce<null | ScoredBeer>((best, hit: UntappdHit) => {
      const similarityRate = Math.max(
        stringSimilarity.compareTwoStrings(productName, hit.beer_name),
        stringSimilarity.compareTwoStrings(productName, hit.brewery_beer_name)
      )

      const current: ScoredBeer = {
        brewery: hit.brewery_name,
        link: `https://untappd.com/b/${hit.beer_slug}/${hit.bid.toString()}`,
        name: hit.beer_name,
        // Untappd reports no score (null or 0) for beers with too few
        // check-ins; normalize to 0 so the UI can render it as "N/A".
        rating: hit.rating_score ?? 0,
        similarityRate,
        status: RatingResultStatus.Found,
        votes: hit.rating_count ?? 0
      }

      return similarityRate > (best?.similarityRate ?? 0) ? current : best
    }, null)

    if (!bestMatch || bestMatch.similarityRate < 0.2) {
      return {
        link: searchFallbackUrl,
        status: RatingResultStatus.Uncertain
      } as RatingResponse
    }

    return bestMatch
  } catch {
    return { status: RatingResultStatus.NotFound } as RatingResponse
  }
}

export async function fetchRatingFromVivino(
  query: string
): Promise<RatingResponse> {
  const params = new URLSearchParams({
    facets: 'false',
    language: 'en',
    min_rating: '0',
    order: 'desc',
    order_by: 'relevance',
    page: '1',
    search_term: query
  })
  const url = `https://www.vivino.com/api/explore/explore?${params.toString()}`
  const searchFallbackUrl = `https://www.vivino.com/search/wines?q=${encodeURIComponent(query)}`

  try {
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
      }
    })

    if (!response.ok) {
      return { status: RatingResultStatus.NotFound } as RatingResponse
    }

    const data = (await response.json()) as VivinoResponseJSON
    const matches = data.explore_vintage?.matches ?? []

    if (matches.length === 0) {
      return { status: RatingResultStatus.NotFound } as RatingResponse
    }

    type ScoredWine = RatingResponse & { similarityRate: number }

    const bestMatch = matches.reduce<null | ScoredWine>(
      (best, match: VivinoMatch) => {
        const wineName = match.vintage.name
        const rating = match.vintage.statistics.ratings_average ?? 0
        const votes = match.vintage.statistics.ratings_count ?? 0
        const link = `https://www.vivino.com/wines/${match.vintage.wine.id.toString()}`
        const similarityRate = stringSimilarity.compareTwoStrings(
          query,
          wineName
        )

        const current: ScoredWine = {
          link,
          name: wineName,
          rating,
          similarityRate,
          status: RatingResultStatus.Found,
          votes
        }

        return similarityRate > (best?.similarityRate ?? 0) ? current : best
      },
      null
    )

    if (!bestMatch || bestMatch.similarityRate < 0.5) {
      return {
        link: searchFallbackUrl,
        status: RatingResultStatus.Uncertain
      } as RatingResponse
    }

    return bestMatch
  } catch {
    return { status: RatingResultStatus.NotFound } as RatingResponse
  }
}
