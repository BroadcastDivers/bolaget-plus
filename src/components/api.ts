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
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
      }
    })

    if (!response.ok) {
      console.error('[Vivino] API error:', response.status)
      return { status: RatingResultStatus.NotFound } as RatingResponse
    }

    const data = await response.json() as VivinoReponseJSON
    const matches = data.explore_vintage?.matches ?? []

    if (matches.length === 0) {
      return { status: RatingResultStatus.NotFound } as RatingResponse
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
      console.error('[Vivino] Best match rejected:', bestMatch?.name, 'similarity:', bestMatch?.similarityRate)
      return {
        link: searchFallbackUrl,
        status: RatingResultStatus.Uncertain
      } as RatingResponse
    }

    return bestMatch
  } catch (e) {
    console.error('[Vivino] API error for query:', query, e)
    return { status: RatingResultStatus.NotFound } as RatingResponse
  }
}
