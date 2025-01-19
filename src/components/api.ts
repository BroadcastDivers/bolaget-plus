import browser from 'webextension-polyfill'
import {
  ProductType,
  RatingResultStatus,
  type GetRating,
  type RatingResponse
} from '@/@types/types'
import * as cheerio from 'cheerio'
import stringSimilarity from 'string-similarity'

const NAME_MATCH_THRESHOLD = 0.5

export async function fetchRating(
  productName: string,
  type: ProductType
): Promise<RatingResponse> {
  try {
    const response = await browser.runtime.sendMessage<
      GetRating,
      RatingResponse
    >({
      query: type,
      productName
    })

    return response
  } catch (error) {
    console.error(`Failed to fetch rating for ${productName}:`, error)
    return { status: RatingResultStatus.NotFound } as RatingResponse
  }
}

export async function fetchRatingFromVivino(
  query: string
): Promise<RatingResponse | null> {
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
        status: RatingResultStatus.Uncertain,
        link: url
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

    const linkElement = wineCard
      .find('a[data-cartitemsource="text-search"]')
      .first()
    const link = `https://www.vivino.com/${linkElement.attr('href')}`
    const vivinoResponse = {
      status: RatingResultStatus.Found,
      name,
      link,
      rating,
      votes
    } as RatingResponse
    return vivinoResponse
  } catch (error) {
    console.error('Error:', error)
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

    const wineCard = $('.beer-item').first()

    const name = wineCard.find('.name').first().text().trim()
    //todo: USE BREWERY
    const brewery = wineCard.find('.brewery').first().text().trim()
    const link = `https://untappd.com${wineCard.find('a').first().attr('href')}`
    const rating = wineCard.find('.num').first().text().trim()

    //TODO: Make specific Untappd response that has brewery in it
    const votes = 0
    const ratingNum = parseFloat(rating.replace('(', '').replace(')', ''))

    return {
      status: RatingResultStatus.Found,
      name: name,
      votes: votes,
      link: link,
      rating: ratingNum
    } as RatingResponse
  } catch (error) {
    console.error('Error:', error)
    return { status: RatingResultStatus.NotFound } as RatingResponse
  }
}
