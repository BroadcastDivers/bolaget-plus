import sentinel from 'sentinel-js';
import { loadSettingAsync } from '@/components/storage';
import * as domUtils from '@/components/domUtils';
import { fetchUntappdRating, fetchVivinoRating } from '@/components/api';
import { translations } from '../translations';
import * as productUtils from '@/components/productUtils';
import { RatingResultStatus, type RatingResponse } from '@/@types/messages';

// TODO: this is required for WXT, look into it or make it fetch settings from storage?
export default defineContentScript({
  matches: ['*://*.systembolaget.se/*'],
  main() {
    // maybe the wrapped async on line 20 should happen here?
    console.log('Hello content.');
  },
});

let fetchingRatingInProgress = false;

(async () => {
  if ((await loadSettingAsync('enabled')) === false) return;

  const winePageSelector = 'h1';
  if (
    window.location?.href.includes('/produkt/vin/') ||
    window.location?.href.includes('/produkt/sprit/') ||
    window.location?.href.includes('/produkt/ol/')
  ) {
    sentinel.on(winePageSelector, tryInsertOnProdcutPage);
  }
})();

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
async function tryInsertOnProdcutPage(_: any) {
  if (fetchingRatingInProgress) {
    return;
  }

  domUtils.injectRatingContainer();
  if (
    window.location?.href.includes('/produkt/vin/') &&
    !productUtils.isBottle()
  ) {
    domUtils.setMessage(translations.notOnBottle);
    return;
  }

  fetchingRatingInProgress = true;
  const productName = productUtils.getProductName();
  if (!productName) {
    return;
  }

  try {
    domUtils.showLoadingSpinner();

    if (window.location.href.includes('/produkt/vin/')) {
      await handleRating(fetchVivinoRating, productName, 'wine');
    }

    if (window.location.href.includes('/produkt/ol/')) {
      await handleRating(fetchUntappdRating, productName, 'beer');
    }
  } catch (error) {
    console.error(`Error fetching rating for ${productName}:`, error);
  } finally {
    fetchingRatingInProgress = false;
  }
}

async function handleRating(
  fetchRatingFunction: (productName: string) => Promise<RatingResponse | null>,
  productName: string,
  type: 'wine' | 'beer'
) {
  const response = await fetchRatingFunction(productName);
  console.log('Response:', response);

  if (!response) return;

  switch (response?.status) {
    case RatingResultStatus.NotFound:
      domUtils.setMessage(translations.noMatch);
      return;
    case RatingResultStatus.Uncertain:
      domUtils.setUncertain(response.link);
      return;
    // case RatingResultStatus.Found:
    //   break;
  }

  if (type === 'wine') {
    domUtils.setWineRating(response.rating, response.votes, response.link);
  } else if (type === 'beer') {
    // domUtils.setRating('beer', response.rating, response.votes, response.link);
    domUtils.setWineRating(response.rating, response.votes, response.link);
  }
}
