// Should be set dynamically? Or should it be retrieved from manifest.json/package.json?
export const version = '1.0.0'

// TODO: Wip
type GitHubRelease = {
  tag_name: string
  html_url: string
}

// TODO: WIP - needs cache
export async function getLatestRelease(): Promise<GitHubRelease | null> {
  const repoOwner = 'BroadcastDivers'
  const repoName = 'systembolaget-ratings'
  const url = `https://api.github.com/repos/${repoOwner}/${repoName}/releases/latest`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.error('Failed to fetch latest release')
      return null
    }
    const release: GitHubRelease = await response.json()
    return release
    //
  } catch (error) {
    console.error('Error fetching latest release:', error)
    return null
  }
}
