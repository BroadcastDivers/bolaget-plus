import {
  BeerResponse,
  ProductType,
  RatingRequest,
  RatingResponse,
  RatingResultStatus
} from '@/@types/types'
import * as cheerio from 'cheerio'
import stringSimilarity from 'string-similarity'
import browser from 'webextension-polyfill'

import { saveRating as cacheRating, tryGetRating } from './ratingsCache'

const NAME_MATCH_THRESHOLD = 0.5

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

    const beerCard = $('.beer-item').first()

    const name = beerCard.find('.name').first().text().trim()
    const brewery = beerCard.find('.brewery').first().text().trim()
    const href = beerCard.find('a').first().attr('href') ?? ''
    const link = `https://untappd.com/${href}`
    const rating = beerCard.find('.num').first().text().trim()

    const votes = 0 //TODO: need to scrape the link to get the number of votes.
    const ratingNum = parseFloat(rating.replace('(', '').replace(')', ''))

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
  const url = `https://www.vivino.com/search/wines?q=${encodeURIComponent(
    query
  )}`

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0 Win64 x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Extracting wine card elements
    const wineCard = $('.default-wine-card').first()
    const name = wineCard.find('.wine-card__name').first().text().trim()

    const similarityRate = stringSimilarity.compareTwoStrings(query, name)
    if (similarityRate < NAME_MATCH_THRESHOLD) {
      return {
        link: url,
        status: RatingResultStatus.Uncertain
      } as RatingResponse
    }

    // Extracting average rating
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

    // TODO: Handle case when there are no/too few ratings

    const linkElement =
      wineCard
        .find('a[data-cartitemsource="text-search"]')
        .first()
        .attr('href') ?? ''
    const link = `https://www.vivino.com/${linkElement}`
    const vivinoResponse = {
      link,
      name,
      rating,
      status: RatingResultStatus.Found,
      votes
    } as RatingResponse

    return vivinoResponse
  } catch {
    return { status: RatingResultStatus.NotFound } as RatingResponse
  }
}
