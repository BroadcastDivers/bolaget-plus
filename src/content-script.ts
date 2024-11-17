// content-script.js

import browser from 'webextension-polyfill';
import sentinel from 'sentinel-js';

let fetchingRatingInProgress = false;

(async () => {
  const winePageSelector = 'h1';
  sentinel.on(winePageSelector, insertOnProdcutPage);
})();

function getProductName(): string | null {
  let header = document.querySelector('main h1')?.children;

  if (!header || header.length === 0) {
    return null;
  }

  const firstLine = (header[0] as HTMLElement).innerText.trim();
  if (header.length === 1) {
    return firstLine;
  }

  var secondLine = (header[1] as HTMLElement).innerText;
  const lastCommaIndex = secondLine.lastIndexOf(',');

  // Check if a comma was found and slice the string accordingly
  secondLine = lastCommaIndex !== -1 ? secondLine.slice(0, lastCommaIndex) : secondLine;

  return `${firstLine} ${secondLine}`;
}

async function insertOnProdcutPage(_: any) {
  if (fetchingRatingInProgress) {
    return;
  }

  const wineUrl = location.href.includes('/produkt/vin/');
  if (!wineUrl) {
    return;
  }

  fetchingRatingInProgress = true;
  const productName = getProductName();
  if (!productName) {
    return;
  }

  try {
    console.log(`Calling to search for: ${productName}`)
    const rating = await fetchVivinoRating(productName);
    if (rating) {
      console.log(rating);
    }
  } catch (error) {
    console.error(`Error fetching rating for ${productName}:`, error);
  }
  finally {
    fetchingRatingInProgress = false;
  }
};

async function fetchVivinoRating(productName: string): Promise<any | null> {
  try {
    const response = await browser.runtime.sendMessage({ query: 'getRating', productName });
    return response;
  } catch (error) {
    console.error(`Failed to get rating for ${productName}:`, error);
    return null;
  }
}
