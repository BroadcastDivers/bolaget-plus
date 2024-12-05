// api.ts
import browser from 'webextension-polyfill'
import { VivinoResponse } from './types'

export async function fetchVivinoRating(
  productName: string
): Promise<VivinoResponse | null> {
  try {
    const response = await browser.runtime.sendMessage({
      query: 'getRating',
      productName
    })
    return typeof response === 'string'
      ? (JSON.parse(response) as VivinoResponse)
      : null
  } catch (error) {
    console.error(`Failed to fetch rating for ${productName}:`, error)
    return null
  }
}
