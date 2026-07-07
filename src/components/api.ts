import * as cheerio from 'cheerio'
import stringSimilarity from 'string-similarity'

import {
  BeerResponse,
  RatingResponse,
  RatingResultStatus,
  VivinoMatch,
  VivinoReponseJSON
} from '@/@types/types'

export async function fetchRatingFromUntappd(
  productName: string
): Promise<RatingResponse> {
  const url = `https://untappd.com/search?q=${encodeURIComponent(
    productName
  )}&type=beer&sort=all`
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
  }

  try {
    const response = await fetch(url, {
      headers
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`)
    }

    const html = await response.text()
    if (html.includes("We didn't find any beers matching")) {
      return { status: RatingResultStatus.NotFound } as RatingResponse
    }

    const $ = cheerio.load(html)
    const beerCard = $('.beer-item').first()

    const name = beerCard.find('.name').first().text().trim()
    const similarityRate = stringSimilarity.compareTwoStrings(productName, name)
    if (similarityRate < 0.2) {
      return {
        link: url,
        status: RatingResultStatus.Uncertain
      } as RatingResponse
    }

    const brewery = beerCard.find('.brewery').first().text().trim()
    const href = beerCard.find('a').first().attr('href') ?? ''
    const link = `https://untappd.com/${href}`

    const rating = beerCard.find('.num').first().text().trim()

    const ratingNum = parseFloat(rating.replace('(', '').replace(')', ''))

    const responseDetailPage = await fetch(link, {
      headers
    })

    const detailHtml = await responseDetailPage.text()
    const detailCard = cheerio.load(detailHtml)('.details').first()
    const lastParagraph = detailCard.find('p').last()
    const votes = parseInt(lastParagraph.text().replace(/[^0-9]/g, ''), 10)

    return {
      brewery: brewery,
      link: link,
      name: name,
      rating: ratingNum,
      status: RatingResultStatus.Found,
      votes: votes
    } as BeerResponse
  } catch {
    return { status: RatingResultStatus.NotFound } as RatingResponse
  }
}

const VIVINO_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

export async function fetchRatingFromVivino(
  query: string
): Promise<RatingResponse> {
  const searchFallbackUrl = `https://www.vivino.com/search/wines?q=${encodeURIComponent(
    query
  )}`

  try {
    // The explore API is fast and structured, but only indexes wines in
    // Vivino's marketplace — it misses catalogue-only wines that have a
    // ratings page yet aren't listed for sale.
    const apiMatch = await searchVivinoExploreApi(query)
    if (apiMatch) {
      return apiMatch
    }

    // Fall back to scraping the public web search, which lists catalogue-only
    // wines the explore API skips.
    const scrapedMatch = await searchVivinoSearchPage(query)
    if (scrapedMatch) {
      return scrapedMatch
    }

    // Nothing solid found — hand the user a working Vivino search link rather
    // than a dead-end "no rating" message.
    return {
      link: searchFallbackUrl,
      status: RatingResultStatus.Uncertain
    } as RatingResponse
  } catch {
    return {
      link: searchFallbackUrl,
      status: RatingResultStatus.Uncertain
    } as RatingResponse
  }
}

// Queries Vivino's marketplace explore API and returns the best confident
// match, or null when nothing usable is found (no matches, low similarity,
// missing rating, or a non-OK response).
async function searchVivinoExploreApi(
  query: string
): Promise<null | RatingResponse> {
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

  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'User-Agent': VIVINO_USER_AGENT
    }
  })

  if (!response.ok) {
    return null
  }

  const data = (await response.json()) as VivinoReponseJSON
  const matches = data.explore_vintage?.matches ?? []

  if (matches.length === 0) {
    return null
  }

  type ScoredWine = RatingResponse & { similarityRate: number }

  const bestMatch = matches.reduce<null | ScoredWine>(
    (best, match: VivinoMatch) => {
      const wineName = match.vintage.name
      const rating = match.vintage.statistics.ratings_average ?? -1
      const votes = match.vintage.statistics.ratings_count ?? -1
      const link = `https://www.vivino.com/wines/${match.vintage.wine.id.toString()}`
      const similarityRate = stringSimilarity.compareTwoStrings(query, wineName)

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

  if (
    !bestMatch ||
    bestMatch.similarityRate < 0.5 ||
    bestMatch.rating < 0 ||
    bestMatch.votes < 0
  ) {
    return null
  }

  return bestMatch
}

// Scrapes Vivino's public web search results, which surface catalogue-only
// wines missing from the explore API. Returns a Found match when a confident,
// rated wine card is parsed; an Uncertain deep-link when a plausible wine card
// is found without a trustworthy rating; or null when nothing is found.
async function searchVivinoSearchPage(
  query: string
): Promise<null | RatingResponse> {
  const url = `https://www.vivino.com/search/wines?q=${encodeURIComponent(
    query
  )}`

  const response = await fetch(url, {
    headers: {
      Accept: 'text/html',
      'User-Agent': VIVINO_USER_AGENT
    }
  })

  if (!response.ok) {
    return null
  }

  const $ = cheerio.load(await response.text())
  const card = $('.default-wine-card, .wine-card').first()
  if (card.length === 0) {
    return null
  }

  const href =
    card.find('a[href*="/w/"], a[href*="/wines/"]').first().attr('href') ?? ''
  if (!href) {
    return null
  }
  const link = new URL(href, 'https://www.vivino.com').toString()

  const name = card
    .find('.wine-card__name, .header-smaller')
    .first()
    .text()
    .trim()
  const similarityRate = stringSimilarity.compareTwoStrings(query, name)

  const rating = parseFloat(
    card.find('.average__number').first().text().trim().replace(',', '.')
  )
  const votes = parseInt(
    card
      .find('.average__stars .text-micro, .text-micro')
      .first()
      .text()
      .replace(/[^0-9]/g, ''),
    10
  )

  const hasConfidentName = name.length > 0 && similarityRate >= 0.5
  const hasRating =
    Number.isFinite(rating) && rating > 0 && Number.isFinite(votes) && votes > 0

  if (hasConfidentName && hasRating) {
    return {
      link,
      name,
      rating,
      status: RatingResultStatus.Found,
      votes
    }
  }

  // We found a plausible wine page but couldn't confirm a trustworthy rating —
  // deep-link the wine so the user can check it directly.
  return {
    link,
    status: RatingResultStatus.Uncertain
  } as RatingResponse
}
