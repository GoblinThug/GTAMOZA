/**
 * Single source of truth for GitHub Releases / auto-update.
 * Change these values when the GTAMOZA repository is ready.
 */
export const GITHUB_OWNER = 'GoblinThug'
export const GITHUB_REPO = 'GTAMOZA'

/** Window title, shortcuts, installer display name (spaces OK). */
export const APP_DISPLAY_NAME = 'GTA Moza Drive'

export const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`

export const APP_CONFIG = {
  displayName: APP_DISPLAY_NAME,
  github: {
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    releasesUrl: GITHUB_RELEASES_URL,
  },
} as const
