import browser from 'webextension-polyfill';
import sentinel from 'sentinel-js';
import { VivinoResponse } from './types';

let fetchingRatingInProgress = false;

(async () => {
  const winePageSelector = 'h1';
  sentinel.on(winePageSelector, tryInsertOnProdcutPage);
})();

async function tryInsertOnProdcutPage(_: any) {
  if (fetchingRatingInProgress || !location.href.includes('/produkt/vin/') ) {
    return;
  }

  if (!isBottle()) {
    insertVivinoHtmlElement(null, "Vinet är inte på flaska")
    return
  }

  fetchingRatingInProgress = true;
  const productName = getProductName();
  if (!productName) {
    console.warn("Failed to extract product name.");
    return;
  }

  try {
    const rating = await fetchVivinoRating(productName);
    if (rating) {
      insertVivinoHtmlElement(rating);
    }
  } catch (error) {
    console.error(`Error fetching rating for ${productName}:`, error);
  }
  finally {
    fetchingRatingInProgress = false;
  }
};

function getProductName(): string | null {
  const headerChildren = document.querySelector('main h1')?.children;

  if (!headerChildren || headerChildren.length === 0) {
    return null;
  }

  const firstLine = (headerChildren[0] as HTMLElement)?.innerText.trim() ?? '';
  if (headerChildren.length === 1) {
    return firstLine;
  }

  const secondLine = (headerChildren[1] as HTMLElement)?.innerText.trim() ?? '';
  const secondLineWithoutComma = secondLine.includes(',')
    ? secondLine.slice(0, secondLine.lastIndexOf(',')).trim()
    : secondLine;

  return `${firstLine} ${secondLineWithoutComma}`.trim();
}


async function fetchVivinoRating(productName: string): Promise<VivinoResponse | null> {
  try {
    const response = await browser.runtime.sendMessage({ query: 'getRating', productName });
    return typeof response === 'string' ? (JSON.parse(response) as VivinoResponse) : null;
  } catch (error) {
    console.error(`Failed to fetch rating for ${productName}:`, error);
    return null;
  }
}

function insertVivinoHtmlElement(wine: VivinoResponse | null, message?: string) {
  document.getElementById("vivino-rating-container")?.remove()

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

  const header = '<h3 style="color: #856404; text-align: center;">Systembolaget ratings</h3>';
  if (wine) {
    ratingContainer.innerHTML = `
      ${header}
      <div style="display: flex; align-items: center; gap: 5px;">
        <strong>Vivino betyg:</strong>
        ${generateStarsSvg(wine.rating)}  (${wine.rating} av ${wine.votes} röster)
      </div>
      <a href="${wine.link}" target="_blank" rel="noopener noreferrer" style="color: #155724; text-decoration: underline;">
        Länk till Vivino
      </a>
    `;
  } else if (message) {
    ratingContainer.innerHTML = `
      ${header}
      <div style="color: #856404; text-align: center;">
        ${message}
      </div>
    `;
  }

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
  const container = document.querySelector("main h1")?.parentElement?.parentElement
  if (container == null) {
    return false;
  }

  const isBottle = Array.from(container.querySelectorAll('p')).find(
    (p) => p !== null && p.textContent?.includes('flaska')
  );

  return isBottle !== undefined
}
