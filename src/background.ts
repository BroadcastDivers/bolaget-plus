import * as cheerio from 'cheerio';
import browser from "webextension-polyfill";

console.log("background script initialized");
async function fetchRatingFromVivino(query: string): Promise<string> {
  const url = `https://www.vivino.com/search/wines?q=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extracting wine card elements
    const wineCard = $('.default-wine-card').first();

    // Extracting average rating
    const averageRating = wineCard.find('.average__container .average__number').first().text().trim();

    // Extracting number of ratings
    const numberOfRatings = wineCard.find('.average__stars .text-micro').first().text().trim();

    console.log(`Average Rating: ${averageRating}`);
    console.log(`Number of Ratings: ${numberOfRatings}`);

    return averageRating;
  } catch (error) {
    console.error('Error:', error);
  }
  return '';
}


browser.runtime.onMessage.addListener(
  async (message: unknown, _sender, sendResponse): Promise<void> => {
    // Type guard to ensure message is of type VivinoMessage
    if (
      typeof message === "object" &&
      message !== null &&
      "query" in message &&
      "productName" in message
    ) {
      const { query, productName } = message as VivinoMessage;

      console.log("GET RATING!");
      if (query === "getRating") {
        try {
          const rating = await fetchRatingFromVivino(productName);
          sendResponse({ rating });
        } catch (error) {
          console.error("Failed to fetch rating:", error);
          sendResponse({ rating: "N/A" });
        }
      }
    } else {
      console.error("Invalid message format received:", message);
      sendResponse({ rating: "Invalid message" });
    }

    return;
  }
);
