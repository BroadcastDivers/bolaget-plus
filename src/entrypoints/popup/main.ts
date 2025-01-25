import { getLatestRelease, version } from '@/components/github'
import {
  beerFeatureEnabled,
  featuresEnabled,
  wineFeatureEnabled
} from '@/components/settings'

async function checkForUpdate(
  installUpdateButton: HTMLButtonElement
): Promise<void> {
  const release = await getLatestRelease()
  if (release && version !== release.tag_name) {
    installUpdateButton.disabled = false
    installUpdateButton.addEventListener('click', () => {
      window.open(release.html_url, '_blank')
    })
  }
}

async function initialize(): Promise<void> {
  await setupToggles()

  const shareButton = document.getElementById('shareButton')
  if (shareButton) {
    shareButton.addEventListener('click', shareExtension)
  }

  const installUpdateButton = document.getElementById(
    'updateButton'
  ) as HTMLButtonElement
  await checkForUpdate(installUpdateButton)
}

async function setupToggles(): Promise<void> {
  const enabledToggle = document.getElementById('enabled') as HTMLInputElement
  enabledToggle.checked = await featuresEnabled.getValue()
  enabledToggle.addEventListener('change', async () => {
    await featuresEnabled.setValue(enabledToggle.checked)
  })

  const wineToggle = document.getElementById('vin') as HTMLInputElement
  wineToggle.checked = await wineFeatureEnabled.getValue()
  wineToggle.addEventListener('change', async () => {
    await wineFeatureEnabled.setValue(wineToggle.checked)
  })

  const beerToggle = document.getElementById('ol') as HTMLInputElement
  beerToggle.checked = await beerFeatureEnabled.getValue()
  beerToggle.addEventListener('change', async () => {
    await beerFeatureEnabled.setValue(beerToggle.checked)
  })
}

async function shareExtension(): Promise<void> {
  const extensionUrl = 'https://addons.mozilla.org/en-US/firefox/extensions/' //TODO:
  try {
    await navigator.clipboard.writeText(extensionUrl)
  } catch {
    //eslint-disable-next-line no-console
    console.error('Failed to copy extension URL to clipboard')
  }
}

document.addEventListener('DOMContentLoaded', initialize)
