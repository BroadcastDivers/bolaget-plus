// Should be set dynamically? Or should it be retrieved from manifest.json/package.json?
export const version = '1.0.0'

// TODO: Wip
interface GitHubRelease {
  html_url: string
  tag_name: string
}

// TODO: WIP - needs cache
export async function getLatestRelease(): Promise<GitHubRelease | null> {
  const repoOwner = 'BroadcastDivers'
  const repoName = 'systembolaget-ratings'
  const url = `https://api.github.com/repos/${repoOwner}/${repoName}/releases/latest`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }
    const release: GitHubRelease = (await response.json()) as GitHubRelease
    // eslint-disable-next-line no-console
    console.log('release', release)
    // eslint-disable-next-line no-console
    console.warn(`Latest release: ${release.tag_name} (${release.html_url})`)
    return release
  } catch {
    return null
  }
}
