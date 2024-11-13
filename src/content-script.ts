// content-script.js

import browser from 'webextension-polyfill';
import sentinel from 'sentinel-js';

const insertOnProdcutPage = async (elTrigger: any) => {
  // Systembolaget Data
  // const sbName = document.querySelector('main h1')?.innerHTML.trim();
  // const sbName2 = document.querySelector('main h1')?.textContent?.trim();
  // alert(`sbName2: ${sbName2}`);

  const sbNameElements = document.querySelectorAll('main h1 p');
  let sbName3 = '';
  sbNameElements.forEach((element) => {
    sbName3 += element.textContent + ' ';
  });
  sbName3 = sbName3.trim();

  if (!sbName3 || sbName3 == '') return;

  console.log(`sbName3: ${sbName3}`);

  // const sbType = document
  //   .querySelector('main h4')
  //   ?.parentElement?.parentElement?.innerText.trim();
  // if (sbType !== '' && sbType !== null && sbType !== undefined) {
  //   console.log(`sbType: ${sbType}`);
  // }
  // productName = sbName ?? '';

  try {
    const rating = await fetchVivinoRating(sbName3);
    if (rating) {
      console.log('rating!');
      console.log(rating);
    }
  } catch (error) {
    console.error(`Error fetching rating for ${sbName3}:`, error);
  }
};

(async () => {
  // const observer = new IntersectionObserver((entries, observer) => {
  //   entries.forEach((entry) => {
  //     console.log(entry);
  //     if (entry.isIntersecting) {
  //       console.log('Element is in view');
  //       observer.disconnect();
  //     }
  //   });
  // });

  let productName = '';

  const wineUrl = location.href.includes('/produkt/vin/');
  if (wineUrl) {
    const winePageSelector = 'h3';
    sentinel.on(winePageSelector, insertOnProdcutPage);
  }

  if (!productName || productName === '') {
    console.log('No product name found');
    return;
  }
  try {
    const rating = await fetchVivinoRating(productName);
    if (rating) {
      console.log('rating!');
      console.log(rating);
    }
  } catch (error) {
    console.error(`Error fetching rating for ${productName}:`, error);
  }
})();

function fetchVivinoRating(productName: string): Promise<string | null> {
  console.log('calling fetchVivinoRating');
  return new Promise((resolve) => {
    browser.runtime
      .sendMessage({ query: 'getRating', productName })
      .then((response) => {
        console.log(`response ${response}`);
        resolve((response as VivinoResponse)?.rating ?? null);
      })
      .catch((error) => {
        console.error(`Failed to get rating for ${productName}:`, error);
        resolve(null);
      });
  });
}
