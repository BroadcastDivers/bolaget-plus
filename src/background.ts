import * as cheerio from 'cheerio'
import browser from 'webextension-polyfill'
import { VivinoMessage, VivinoResponse } from './types'
import stringSimilarity from 'string-similarity'

const NAME_MATCH_THRESHOLD = 0.5

async function fetchRatingFromVivino(query: string): Promise<string | null> {
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
      return JSON.stringify({
        found: false,
        name: null,
        link: null,
        rating: null,
        votes: null
      } as VivinoResponse)
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

    const linkElement = wineCard
      .find('a[data-cartitemsource="text-search"]')
      .first()
    const link = `https://www.vivino.com/${linkElement.attr('href')}`
    const vivinoResponse = {
      found: true,
      name,
      link,
      rating,
      votes
    } as VivinoResponse
    return JSON.stringify(vivinoResponse)
  } catch (error) {
    console.error('Error:', error)
  }
  return null
}

browser.runtime.onMessage.addListener(async (message) => {
  if (
    typeof message === 'object' &&
    message !== null &&
    'query' in message &&
    'productName' in message
  ) {
    const { productName } = message as VivinoMessage

    return await fetchRatingFromVivino(productName)
  }
})
