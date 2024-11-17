import browser from 'webextension-polyfill';

// Helper function to save a boolean setting in local storage
async function saveSetting(key: string, value: boolean): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}

// Helper function to load a boolean setting from local storage
async function loadSetting(key: string): Promise<boolean> {
  const result = await browser.storage.local.get(key);
  return result[key] !== undefined ? (result[key] as boolean) : true;
}

// Initialize the settings
async function initialize() {
  const enabledCheckbox = document.getElementById(
    'enabled'
  ) as HTMLInputElement;
  const wineCheckbox = document.getElementById('wine') as HTMLInputElement;
  const beerCheckbox = document.getElementById('beer') as HTMLInputElement;
  const liquorCheckbox = document.getElementById('liquor') as HTMLInputElement;

  // Load and set initial checkbox states from local storage
  enabledCheckbox.checked = await loadSetting('enabled');
  wineCheckbox.checked = await loadSetting('wine');
  beerCheckbox.checked = await loadSetting('beer');
  liquorCheckbox.checked = await loadSetting('liquor');

  // Event listeners to save checkbox states when changed
  enabledCheckbox.addEventListener('change', () =>
    saveSetting('enabled', enabledCheckbox.checked)
  );
  wineCheckbox.addEventListener('change', () =>
    saveSetting('wine', wineCheckbox.checked)
  );
  beerCheckbox.addEventListener('change', () =>
    saveSetting('beer', beerCheckbox.checked)
  );
  liquorCheckbox.addEventListener('change', () =>
    saveSetting('liquor', liquorCheckbox.checked)
  );
}

// Run the initialize function when the popup is loaded
document.addEventListener('DOMContentLoaded', initialize);
