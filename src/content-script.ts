// content-script.js

import browser from 'webextension-polyfill';
import sentinel from 'sentinel-js';
import { VivinoResponse } from './types';

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
      insertRatingIntoPage(rating);
    }
  } catch (error) {
    console.error(`Error fetching rating for ${productName}:`, error);
  }
  finally {
    fetchingRatingInProgress = false;
  }
};

async function fetchVivinoRating(productName: string): Promise<VivinoResponse | null> {
  try {
    const response = await browser.runtime.sendMessage({ query: 'getRating', productName });
    if (typeof (response) !== 'string') {
      return null;
    }

    return JSON.parse(response) as VivinoResponse
  } catch (error) {
    console.error(`Failed to get rating for ${productName}:`, error);
    return null;
  }
}

function insertRatingIntoPage(wine: VivinoResponse) {
  const ratingContainer = document.createElement('div');
  ratingContainer.id = 'vivino-rating-container';
  ratingContainer.style.cssText = `
    background-color: #fff3cd;
    padding: 10px;
    margin-top: 10px;
    border: 1px solid #ffeeba;
    border-radius: 4px;
    font-family: Arial, sans-serif;
    font-size: 14px;
  `;

  // Set the inner HTML content
  ratingContainer.innerHTML = `
    <strong>Vivino betyg:</strong> ${wine.rating} ⭐ (${wine.votes} röster)<br>
    <a href="${wine.link}" target="_blank" rel="noopener noreferrer" style="color: #155724; text-decoration: underline;">
      Länk till Vivino
    </a>
  `;

  // Insert the ratingContainer into the product page, below the main header
  const productHeader = document.querySelector('main h1');
  if (productHeader && productHeader.parentNode) {
    productHeader.parentNode.insertBefore(ratingContainer, productHeader.nextSibling);
  }
}
