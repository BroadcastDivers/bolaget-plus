import browser from 'webextension-polyfill';

/* 
todo: Maybe create a type for the settings
or create a class/something that wraps the
settings 'enabled' 'vin' 'ol' 'sprit'?
It might be needed since the popup initializes the settings
and the content script reads them.
*/

/**
 * Asynchronously saves a boolean setting in the browser's local storage.
 *
 * @param key - The key under which the value will be stored.
 * @param value - The boolean value to be stored.
 * @returns A promise that resolves when the value has been saved.
 */
async function saveSettingAsync(key: string, value: boolean): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}

/**
 * Asynchronously loads a boolean setting from the browser's local storage.
 *
 * @param {string} key - The key of the setting to load.
 * @returns {Promise<boolean>} A promise that resolves to the value of the setting.
 * If the setting is not found, it defaults to `true`.
 */
async function loadSettingAsync(key: string): Promise<boolean> {
  const result = await browser.storage.local.get(key);
  return (result[key] as boolean) ?? true;
}

// async function initSettingsAsync(): Promise<void> {
//   const settings = {
//     enabled: false,
//     vin: false,
//     ol: false,
//     sprit: false,
//   };

//   await browser.storage.local.set(settings);
// }

export { saveSettingAsync, loadSettingAsync };
