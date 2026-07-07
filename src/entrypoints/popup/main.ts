import { getLatestRelease, version } from '@/components/github'
import {
  beerFeatureEnabled,
  ciderFeatureEnabled,
  featuresEnabled,
  wineFeatureEnabled
} from '@/components/settings'

async function checkForUpdate(
  installUpdateButton: HTMLButtonElement
): Promise<void> {
  const release = await getLatestRelease()
  const latest = release?.tag_name.replace(/^v/, '')
  if (release && latest !== version) {
    installUpdateButton.disabled = false
    installUpdateButton.addEventListener('click', () => {
      window.open(release.html_url, '_blank')
    })
  }
}

async function initialize(): Promise<void> {
  showVersion()
  await setupToggles()

  const shareButton = document.getElementById('shareButton')
  if (shareButton) {
    shareButton.addEventListener('click', () => {
      void shareExtension()
    })
  }

  const installUpdateButton = document.getElementById(
    'updateButton'
  ) as HTMLButtonElement | null
  if (installUpdateButton) {
    await checkForUpdate(installUpdateButton)
  }
}

async function setupToggles(): Promise<void> {
  const enabledToggle = document.getElementById('enabled') as HTMLInputElement
  enabledToggle.checked = await featuresEnabled.getValue()
  enabledToggle.addEventListener('change', () => {
    void featuresEnabled.setValue(enabledToggle.checked)
  })

  const wineToggle = document.getElementById('wine') as HTMLInputElement
  wineToggle.checked = await wineFeatureEnabled.getValue()
  wineToggle.addEventListener('change', () => {
    void wineFeatureEnabled.setValue(wineToggle.checked)
  })

  const beerToggle = document.getElementById('beer') as HTMLInputElement
  beerToggle.checked = await beerFeatureEnabled.getValue()
  beerToggle.addEventListener('change', () => {
    void beerFeatureEnabled.setValue(beerToggle.checked)
  })

  const ciderToggle = document.getElementById('cider') as HTMLInputElement
  ciderToggle.checked = await ciderFeatureEnabled.getValue()
  ciderToggle.addEventListener('change', () => {
    void ciderFeatureEnabled.setValue(ciderToggle.checked)
  })
}

async function shareExtension(): Promise<void> {
  const extensionUrl = 'https://addons.mozilla.org/firefox/addon/bolaget-plus/'
  try {
    await navigator.clipboard.writeText(extensionUrl)
  } catch {
    //eslint-disable-next-line no-console
    console.error('Failed to copy extension URL to clipboard')
  }
}

function showVersion(): void {
  const versionLabel = document.querySelector('.version')
  if (versionLabel) {
    versionLabel.textContent = `v${version}`
  }
}

document.addEventListener('DOMContentLoaded', () => {
  void initialize()
})
