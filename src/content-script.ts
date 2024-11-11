// content-script.js

import browser from "webextension-polyfill";

(async () => {

  const productName = "19 crimes";
  console.log("Async operation finished");
  try {
    const rating = await fetchVivinoRating(productName);
    if (rating) {
      console.log("rating!")
      console.log(rating);
    }
  } catch (error) {
    console.error(`Error fetching rating for ${productName}:`, error);
  }
})();

function fetchVivinoRating(productName: string): Promise<string | null> {

  console.log("calling fetchVivinoRating");
  return new Promise((resolve) => {
    browser.runtime.sendMessage({ query: "getRating", productName })
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
