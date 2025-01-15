import browser from 'webextension-polyfill'
import {
  MessageType,
  type FetchMessage,
  type RatingResponse
} from '@/@types/messages'

export async function fetchVivinoRating(
  productName: string
): Promise<RatingResponse | null> {
  try {
    const response = await browser.runtime.sendMessage({
      query: 'vivino',
      productName
    })
    return typeof response === 'string'
      ? (JSON.parse(response) as RatingResponse)
      : null
  } catch (error) {
    console.error(`Failed to fetch rating for ${productName}:`, error)
    return null
  }
}

export async function fetchUntappdRating(
  productName: string
): Promise<RatingResponse | null> {
  try {
    console.log('Inside fetchUntappdRating')

    const message: FetchMessage = {
      query: MessageType.Untappd,
      productName
    }
    const response = await browser.runtime.sendMessage(message)

    return typeof response === 'string'
      ? (JSON.parse(response) as RatingResponse) //todo: skip json parse? Sent the ratingresponse
      : null
  } catch (error) {
    console.error(`Failed to fetch rating for ${productName}:`, error)
    return null
  }
}
