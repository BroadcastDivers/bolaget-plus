import browser from 'webextension-polyfill'

// Sourced from the manifest, which WXT generates from package.json's version.
export const version = browser.runtime.getManifest().version

// TODO: Wip
interface GitHubRelease {
  html_url: string
  tag_name: string
}

// TODO: WIP - needs cache
export async function getLatestRelease(): Promise<GitHubRelease | null> {
  const repoOwner = 'BroadcastDivers'
  const repoName = 'bolaget-plus'
  const url = `https://api.github.com/repos/${repoOwner}/${repoName}/releases/latest`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }
    const release: GitHubRelease = (await response.json()) as GitHubRelease
    return release
  } catch {
    return null
  }
}
