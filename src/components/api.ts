import {
  BeerResponse,
  ProductType,
  RatingRequest,
  RatingResponse,
  RatingResultStatus,
  VivinoMatch,
  VivinoReponseJSON
} from '@/@types/types'
import * as cheerio from 'cheerio'
import stringSimilarity from 'string-similarity'
import browser from 'webextension-polyfill'

import { saveRating as cacheRating, tryGetRating } from './ratingsCache'

export async function fetchRating(
  productName: string,
  type: ProductType
): Promise<RatingResponse> {
  try {
    const ratingRequest = { productName, query: type }
    const cachedRating = await tryGetRating(ratingRequest)
    if (cachedRating) {
      return cachedRating
    }
    const response = await browser.runtime.sendMessage<
      RatingRequest,
      RatingResponse
    >(ratingRequest)

    await cacheRating(ratingRequest, response)
    return response
  } catch {
    return { status: RatingResultStatus.NotFound } as RatingResponse
  }
}

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

    const beerResponse = {
      brewery: brewery,
      link: link,
      name: name,
      rating: ratingNum,
      status: RatingResultStatus.Found,
      votes: votes
    } as BeerResponse

    return beerResponse
  } catch {
    return { status: RatingResultStatus.NotFound } as RatingResponse
  }
}
export async function fetchRatingFromVivino(
  query: string
): Promise<null | RatingResponse> {
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

    // Find the `data-preloaded-state` attribute
    const searchPageElement = $('#search-page')
    if (!searchPageElement.length) {
      return { status: RatingResultStatus.NotFound } as RatingResponse
    }
    const preloadedState = searchPageElement.attr('data-preloaded-state')
    if (!preloadedState) {
      return { status: RatingResultStatus.NotFound } as RatingResponse
    }

    const data = JSON.parse(preloadedState) as VivinoReponseJSON

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
        const similarityRate = stringSimilarity.compareTwoStrings(
          query,
          wineName
        )

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
  } catch {
    return { status: RatingResultStatus.NotFound } as RatingResponse
  }
}
