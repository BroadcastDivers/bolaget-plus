import * as cheerio from 'cheerio'
import stringSimilarity from 'string-similarity'

import {
  BeerResponse,
  RatingResponse,
  RatingResultStatus
} from '@/@types/types'

export async function getRating(productName: string): Promise<RatingResponse> {
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
