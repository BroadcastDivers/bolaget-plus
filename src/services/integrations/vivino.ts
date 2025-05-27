import * as cheerio from 'cheerio'
import stringSimilarity from 'string-similarity'

import {
  RatingResponse,
  RatingResultStatus,
  VivinoMatch,
  VivinoReponseJSON
} from '@/@types/types'

export async function getRating(query: string): Promise<RatingResponse> {
  const url = `https://www.vivino.com/search/wines?q=${encodeURIComponent(query)}`

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Try to parse using modern format first (with search page and preloaded state)
    const searchPageElement = $('#search-page')
    if (searchPageElement.length) {
      const preloadedState = searchPageElement.attr('data-preloaded-state')
      if (preloadedState) {
        const data = JSON.parse(preloadedState) as VivinoReponseJSON
        return processVivinoPreloadedState(data, query, url)
      }
    }

    // Fallback to traditional HTML parsing if modern format fails
    if ($('.wine-card__content').length > 0) {
      return processVivinoTraditionalHtml($, query, url)
    }

    return { status: RatingResultStatus.NotFound } as RatingResponse
  } catch {
    return { status: RatingResultStatus.NotFound } as RatingResponse
  }
}

// Function to process the preloaded state JSON
function processVivinoPreloadedState(
  data: VivinoReponseJSON,
  query: string,
  url: string
): RatingResponse {
  const matches = data.search_results?.matches ?? []
  if (matches.length === 0) {
    return { status: RatingResultStatus.NotFound } as RatingResponse
  }

  type Wine = RatingResponse & {
    similarityRate: number
  }
  const bestMatch = matches.reduce<null | Wine>(
    (best: null | Wine, match: VivinoMatch) => {
      const wineName = match.vintage.name
      const rating = match.vintage.statistics.ratings_average ?? -1
      const votes = match.vintage.statistics.ratings_count ?? -1
      const link = `https://www.vivino.com/wines/${match.vintage.id.toString()}`

      // Calculate similarity rate
      const similarityRate = stringSimilarity.compareTwoStrings(query, wineName)

      const current: Wine = {
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
    return {
      link: url,
      status: RatingResultStatus.Uncertain
    } as RatingResponse
  }

  return bestMatch
}

// Function to process the traditional HTML format
function processVivinoTraditionalHtml(
  $: cheerio.CheerioAPI,
  query: string,
  url: string
): RatingResponse {
  const wineCard = $('.default-wine-card').first()
  const name = wineCard.find('.wine-card__name').first().text().trim()
  const ratingRaw = wineCard
    .find('.average__container .average__number')
    .first()
    .text()
    .trim()
    .replace(',', '.')

  const rating = ratingRaw !== '-' ? Number.parseFloat(ratingRaw) : null

  // Extracting number of ratings
  const votesRaw = wineCard
    .find('.average__stars .text-micro')
    .first()
    .text()
    .trim()

  const votes =
    votesRaw.includes(' ratings') || votesRaw.includes(' betyg')
      ? Number.parseInt(votesRaw.split(' ')[0])
      : null

  const linkElement =
    wineCard
      .find('a[data-cartitemsource="text-search"]')
      .first()
      .attr('href') ?? ''

  const link = `https://www.vivino.com${linkElement}`

  // Calculate similarity and determine if this is a good match
  const similarityRate = stringSimilarity.compareTwoStrings(query, name)

  if (similarityRate < 0.3 || rating === null || votes === null) {
    return {
      link: url,
      status: RatingResultStatus.Uncertain
    } as RatingResponse
  }

  return {
    link,
    name,
    rating,
    status: RatingResultStatus.Found,
    votes
  } as RatingResponse
}
