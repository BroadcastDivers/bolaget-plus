// import './style.css';
// import typescriptLogo from '@/assets/typescript.svg';
// import viteLogo from '/wxt.svg';
// import { setupCounter } from '@/components/counter';

// document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
//   <div>
//     <a href="https://wxt.dev" target="_blank">
//       <img src="${viteLogo}" class="logo" alt="WXT logo" />
//     </a>
//     <a href="https://www.typescriptlang.org/" target="_blank">
//       <img src="${typescriptLogo}" class="logo vanilla" alt="TypeScript logo" />
//     </a>
//     <h1>WXT + TypeScript</h1>
//     <div class="card">
//       <button id="counter" type="button"></button>
//     </div>
//     <p class="read-the-docs">
//       Click on the WXT and TypeScript logos to learn more
//     </p>
//   </div>
// `;

// setupCounter(document.querySelector<HTMLButtonElement>('#counter')!);

import { loadSettingAsync, saveSettingAsync } from '@/components/storage';
const version = '1.0.0';

// TODO: Wip
type GitHubRelease = {
  tag_name: string;
  html_url: string;
};

// TODO: WIP - needs cache
async function getLatestRelease(): Promise<GitHubRelease | null> {
  const repoOwner = 'BroadcastDivers';
  const repoName = 'systembolaget-ratings';
  const url = `https://api.github.com/repos/${repoOwner}/${repoName}/releases/latest`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error('Failed to fetch latest release');
      return null;
    }
    const release: GitHubRelease = await response.json();
    return release;
    //
  } catch (error) {
    console.error('Error fetching latest release:', error);
    return null;
  }
}

async function shareExtension(): Promise<void> {
  const extensionUrl = 'https://addons.mozilla.org/en-US/firefox/extensions/';
  try {
    await navigator.clipboard.writeText(extensionUrl);
  } catch (err) {
    console.error('Failed to copy URL:', err);
  }
}

async function checkForUpdate(
  installUpdateButton: HTMLButtonElement
): Promise<void> {
  const release = await getLatestRelease();
  if (release && version !== release.tag_name) {
    installUpdateButton.disabled = false;
    installUpdateButton.addEventListener('click', () => {
      window.open(release.html_url, '_blank');
    });
  }
}

async function initialize(): Promise<void> {
  // Prepare buttons
  const shareButton = document.getElementById('shareButton');
  if (!shareButton) return;
  shareButton.addEventListener('click', shareExtension);

  // Settings Toggles
  // const toggles = ['enabled', 'vin', 'ol', 'sprit']
  const toggles = ['enabled', 'vin'];

  for (const id of toggles) {
    const toggle = document.getElementById(id) as HTMLInputElement;
    toggle.checked = await loadSettingAsync(id);
    console.log(`{${id}}: ${toggle.checked}`);
    toggle.addEventListener(
      'change',
      async () => await saveSettingAsync(id, toggle.checked)
    );
  }

  const installUpdateButton = document.getElementById(
    'updateButton'
  ) as HTMLButtonElement;
  if (!installUpdateButton || installUpdateButton == null) return;
  await checkForUpdate(installUpdateButton);
}

document.addEventListener('DOMContentLoaded', initialize);
