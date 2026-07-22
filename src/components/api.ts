import stringSimilarity from 'string-similarity'

import {
  BeerResponse,
  RatingAlternative,
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

// How many ranked candidates to surface as "did you mean" alternatives when
// no match is confident enough to auto-select.
const MAX_ALTERNATIVES = 3

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

    const scored = hits
      .map((hit: UntappdHit): ScoredBeer => {
        const similarityRate = Math.max(
          stringSimilarity.compareTwoStrings(productName, hit.beer_name),
          stringSimilarity.compareTwoStrings(productName, hit.brewery_beer_name)
        )

        return {
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
      })
      .sort((a, b) => b.similarityRate - a.similarityRate)

    const bestMatch = scored[0]

    if (bestMatch.similarityRate < 0.2) {
      return {
        alternatives: toAlternatives(scored),
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
  // Vivino's explore API only indexes marketplace wines, so misses are common
  // (catalogue-only wines, regional gaps). Instead of a dead-end "no rating"
  // message, always hand the user a working Vivino search link.
  const uncertainFallback = {
    link: `https://www.vivino.com/search/wines?q=${encodeURIComponent(query)}`,
    status: RatingResultStatus.Uncertain
  } as RatingResponse

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
      return uncertainFallback
    }

    const data = (await response.json()) as VivinoResponseJSON
    const matches = data.explore_vintage?.matches ?? []

    if (matches.length === 0) {
      return uncertainFallback
    }

    type ScoredWine = RatingResponse & { similarityRate: number }

    const scored = matches
      .map((match: VivinoMatch): ScoredWine => {
        const wineName = match.vintage.name
        const rating = match.vintage.statistics.ratings_average ?? 0
        const votes = match.vintage.statistics.ratings_count ?? 0
        const link = `https://www.vivino.com/wines/${match.vintage.id.toString()}`
        const similarityRate = stringSimilarity.compareTwoStrings(
          query,
          wineName
        )

        return {
          link,
          name: wineName,
          rating,
          similarityRate,
          status: RatingResultStatus.Found,
          votes
        }
      })
      .sort((a, b) => b.similarityRate - a.similarityRate)

    const bestMatch = scored[0]

    if (bestMatch.similarityRate < 0.5) {
      return { ...uncertainFallback, alternatives: toAlternatives(scored) }
    }

    return bestMatch
  } catch {
    return uncertainFallback
  }
}

function toAlternatives(
  scored: {
    link: null | string
    name: null | string
    rating: number
    votes: number
  }[]
): RatingAlternative[] {
  return scored
    .slice(0, MAX_ALTERNATIVES)
    .filter(
      (s): s is { link: string; name: string; rating: number; votes: number } =>
        s.link !== null && s.name !== null
    )
    .map(({ link, name, rating, votes }) => ({ link, name, rating, votes }))
}
