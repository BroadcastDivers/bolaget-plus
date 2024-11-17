import * as cheerio from 'cheerio';
import browser from 'webextension-polyfill';
import { VivinoMessage } from './types';

console.log('background script initialized');
async function fetchRatingFromVivino(query: string): Promise<string | null> {
  const url = `https://www.vivino.com/search/wines?q=${encodeURIComponent(
    query
  )}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch: ${response.statusText}`);
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extracting wine card elements
    const wineCard = $('.default-wine-card').first();

    const name = wineCard.find('.wine-card__name')
    .first()
    .text()
    .trim();
    // Extracting average rating
    const averageRating = wineCard
      .find('.average__container .average__number')
      .first()
      .text()
      .trim();

    // Extracting number of ratings
    const numberOfRatings = wineCard
      .find('.average__stars .text-micro')
      .first()
      .text()
      .trim();

      
    const linkElement = wineCard.find('a[data-cartitemsource="text-search"]').first();
    const link = new URL(`https://www.vivino.com/${linkElement.attr('href')}`);

    console.log(`Wine name: ${name}`);
    console.log(`Average Rating: ${averageRating}`);
    console.log(`Number of Ratings: ${numberOfRatings}`);
    console.log(`Link ${link}`);

    return averageRating; // TODO: return more data
  } catch (error) {
    console.error('Error:', error);
  }
  return null;
}

browser.runtime.onMessage.addListener(async (message) => {
  if (
    typeof message === "object" &&
    message !== null &&
    "query" in message &&
    "productName" in message
  ) {
    const { query, productName } = message as VivinoMessage;

    return await fetchRatingFromVivino(productName);
  }
});

