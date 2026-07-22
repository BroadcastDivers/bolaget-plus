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

// A hung image download must not hold up the rating itself.
const IMAGE_FETCH_TIMEOUT_MS = 4000

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

    // Return only the response contract — similarityRate is internal.
    return {
      brewery: bestMatch.brewery,
      link: bestMatch.link,
      name: bestMatch.name,
      rating: bestMatch.rating,
      status: bestMatch.status,
      votes: bestMatch.votes
    } as BeerResponse
  } catch {
    return { status: RatingResultStatus.NotFound } as RatingResponse
  }
}

export async function fetchRatingFromVivino(
  query: string,
  includeImage = true
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

    // HTTP errors (429 rate limit, 5xx) are transient — show the search-link
    // fallback but don't let it get cached as a definitive miss.
    if (!response.ok) {
      return { ...uncertainFallback, transient: true }
    }

    const data = (await response.json()) as VivinoResponseJSON
    const matches = data.explore_vintage?.matches ?? []

    if (matches.length === 0) {
      return uncertainFallback
    }

    type ScoredWine = RatingResponse & {
      imageUrl?: string
      similarityRate: number
    }

    const scored = matches
      .map((match: VivinoMatch): ScoredWine => {
        const wineName = match.vintage.name
        const rating = match.vintage.statistics.ratings_average ?? 0
        const votes = match.vintage.statistics.ratings_count ?? 0
        const link = `https://www.vivino.com/wines/${match.vintage.id.toString()}`
        const imageUrl = normalizeImageUrl(
          match.vintage.image?.variations?.label_medium ??
            match.vintage.image?.location
        )
        const similarityRate = stringSimilarity.compareTwoStrings(
          query,
          wineName
        )

        return {
          imageUrl,
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
      const top = scored.slice(0, MAX_ALTERNATIVES)
      if (includeImage) {
        await Promise.all(
          top.map(async (wine) => {
            wine.imageDataUrl = await fetchImageAsDataUrl(wine.imageUrl)
          })
        )
      }
      return { ...uncertainFallback, alternatives: toAlternatives(top) }
    }

    // Return only the response contract — similarityRate/imageUrl are internal.
    return {
      imageDataUrl: includeImage
        ? await fetchImageAsDataUrl(bestMatch.imageUrl)
        : undefined,
      link: bestMatch.link,
      name: bestMatch.name,
      rating: bestMatch.rating,
      status: bestMatch.status,
      votes: bestMatch.votes
    }
  } catch {
    return { ...uncertainFallback, transient: true }
  }
}

// Fetched by the background script because the systembolaget.se page CSP
// (img-src) blocks hotlinking Vivino's image hosts; a data: URL is allowed.
async function fetchImageAsDataUrl(
  url: string | undefined
): Promise<string | undefined> {
  if (!url) {
    return undefined
  }
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS)
    })
    if (!response.ok) {
      return undefined
    }
    const contentType = response.headers.get('content-type') ?? 'image/png'
    const bytes = new Uint8Array(await response.arrayBuffer())
    let binary = ''
    const chunkSize = 8192
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
    }
    return `data:${contentType};base64,${btoa(binary)}`
  } catch {
    return undefined
  }
}

function normalizeImageUrl(url: null | string | undefined): string | undefined {
  if (!url) {
    return undefined
  }
  return url.startsWith('//') ? `https:${url}` : url
}

function toAlternatives(
  scored: {
    imageDataUrl?: string
    link: null | string
    name: null | string
    rating: number
    votes: number
  }[]
): RatingAlternative[] {
  return scored
    .slice(0, MAX_ALTERNATIVES)
    .flatMap(({ imageDataUrl, link, name, rating, votes }) =>
      link !== null && name !== null
        ? [{ imageDataUrl, link, name, rating, votes }]
        : []
    )
}
