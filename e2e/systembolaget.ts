import type { Locator, Page } from '@playwright/test'

// How long to wait for a gate to show up on a freshly loaded page. Generous,
// because these tests hit the live site over whatever the runner's network
// happens to be.
const GATE_TIMEOUT = 10_000

// How long a rating may take to appear. The content script has to round-trip
// through the background script to Vivino/Untappd before it can render.
export const RATING_TIMEOUT = 30_000

/**
 * Clicks away the age gate and the cookie banner.
 *
 * Neither is guaranteed to be there: the profile may already have consented,
 * the site A/B-tests the banner, and the markup has changed before. So a gate
 * that never shows up is not an error — the previous version of these tests
 * clicked both unconditionally, which turned any change to either interstitial
 * into six failures that pointed at the banner instead of at the assertion the
 * test actually cares about.
 */
export async function dismissGates(page: Page): Promise<void> {
  const gates: Locator[] = [
    page.getByRole('link', { name: 'Jag har fyllt 20 år' }).first(),
    page.getByRole('button', { name: 'Acceptera alla kakor' }).first()
  ]

  // Dismissing one gate can reveal the other, so make a second pass — but only
  // if the first pass actually cleared something, and with a short timeout,
  // since by then anything still coming has already had GATE_TIMEOUT to render.
  for (let pass = 0; pass < gates.length; pass++) {
    let dismissedAny = false

    for (const gate of gates) {
      try {
        await gate.waitFor({
          state: 'visible',
          timeout: pass === 0 ? GATE_TIMEOUT : 1_000
        })
      } catch {
        continue // Not on this page (or no longer) — nothing to dismiss.
      }
      await gate.click()
      dismissedAny = true
    }

    if (!dismissedAny) break
  }
}

/**
 * Opens a Systembolaget page with the interstitials cleared.
 *
 * The reload is what makes the ratings show up: the content script runs against
 * whatever the gates were covering, so it needs one clean pass over the real
 * page after they are gone.
 */
export async function openPage(page: Page, url: string): Promise<void> {
  await page.goto(url)
  await dismissGates(page)
  await page.reload()
}
