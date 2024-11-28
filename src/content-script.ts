// content-script.js

import browser from 'webextension-polyfill';
import sentinel from 'sentinel-js';
import { VivinoResponse } from './types';

let fetchingRatingInProgress = false;

(async () => {
  const winePageSelector = 'h1';
  sentinel.on(winePageSelector, tryInsertOnProdcutPage);
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

async function tryInsertOnProdcutPage(_: any) {
  if (fetchingRatingInProgress) {
    return;
  }

  const wineUrl = location.href.includes('/produkt/vin/');
  if (!wineUrl) {
    return;
  }

  if (!isBottle()) {
    console.log("Product is not a bottle")
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
    <div style="display: flex; align-items: center; gap: 5px;">
      <strong>Vivino betyg:</strong>
      ${generateStarsSvg(wine.rating)}  (${wine.rating} av ${wine.votes} röster)
    </div>
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

function generateStarsSvg(rating: number): string {
  const maxStars = 5;
  const redColor = '#dc3545'; // Red color for the stars
  const grayColor = '#e4e5e9'; // Gray color for empty stars

  // Function to create an SVG star with a given fill color
  const starSvg = (fill: string) => `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="${fill}" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 .587l3.668 7.568L24 9.423l-6 5.832 1.416 8.25L12 18.897 4.584 23.505 6 15.255l-6-5.832 8.332-1.268L12 .587z"/>
    </svg>`;

  let starsHtml = '';
  for (let i = 0; i < maxStars; i++) {
    if (rating >= i + 1) {
      // Full red star
      starsHtml += starSvg(redColor);
    } else if (rating >= i + 0.5) {
      // Half red star using linear gradient
      starsHtml += `
        <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="halfStarGradient">
              <stop offset="50%" stop-color="${redColor}" />
              <stop offset="50%" stop-color="${grayColor}" />
            </linearGradient>
          </defs>
          <path d="M12 .587l3.668 7.568L24 9.423l-6 5.832 1.416 8.25L12 18.897 4.584 23.505 6 15.255l-6-5.832 8.332-1.268L12 .587z" fill="url(#halfStarGradient)"/>
        </svg>`;
    } else {
      // Empty gray star
      starsHtml += starSvg(grayColor);
    }
  }

  return `<div style="display: flex;">${starsHtml}</div>`;
}

function isBottle(): boolean {
  const container = document.querySelector("main")
  if (container === null) {
    return false;
  }

  const isBottle = Array.from(container.querySelectorAll('p')).find(
    (p) => p !== null && p.textContent?.includes('flaska')
  );

  return isBottle !== undefined
}
