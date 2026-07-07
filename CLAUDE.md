# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Bolaget+ is a cross-browser (Chrome + Firefox) WebExtension that injects Vivino
(wine) and Untappd (beer) ratings directly onto product pages of
Systembolaget.se, Sweden's alcohol retailer. Built with the
[WXT](https://wxt.dev) framework; TypeScript throughout.

## Commands

Uses **pnpm** (v10). WXT auto-imports its APIs — `defineContentScript`,
`defineBackground`, `defineConfig`, `i18n`, and the storage items exported from
`settings.ts` are available without imports in entrypoint files.

```sh
pnpm dev:chrome        # run in Chrome with HMR (dev server on :3000)
pnpm dev:firefox       # run in Firefox

pnpm compile           # tsc --noEmit — type check
pnpm lint              # eslint (strictTypeChecked + stylistic + perfectionist)
pnpm lint:fix
pnpm ft                # prettier --write on src
pnpm ft:check          # prettier --check (CI uses this)

pnpm build:chrome      # build to .output/ (build:firefox for MV2/Firefox)
pnpm zip:chrome        # package for store submission

pnpm test              # build:chrome then run full Playwright suite
pnpm test:interactive  # playwright --ui
pnpm test:api          # only the Vivino/Untappd API-integration spec
```

Run a single test: `pnpm build:chrome && playwright test -g "beer page"`
(the build step is required — Playwright loads the built extension from
`.output/`).

CI (`.github/workflows/pr.yaml`) runs `compile`, `ft:check`, `lint`, and
`build:chrome` on every PR. The `pre-push` git hook (simple-git-hooks) runs
`ft` + `lint` — installed automatically on `pnpm install`.

## Architecture

The extension is split across three WXT entrypoints in `src/entrypoints/` that
communicate by message-passing. The split exists to work around cross-origin
restrictions: the content script runs in the page's origin
(systembolaget.se) and cannot fetch from vivino.com/untappd.com, so all
external fetches are delegated to the background script.

**Rating flow (the core path):**

1. `content.ts` runs on `*.systembolaget.se/*`. It uses
   [sentinel-js](https://github.com/geoxor/sentinel-js) to watch for the `h1`
   element (Systembolaget is an SPA, so pages swap without full reloads) and
   triggers `tryInsertOnProductPage` on each new product title.
2. `productUtils.ts` derives `ProductType` from the URL path (`/produkt/vin/`
   vs `/produkt/ol/`), extracts the product name from the `<h1>`, and gates
   wine on `isBottle()` (Vivino only rates bottles, not box/bag-in-box/etc. —
   see the exclusion-list note in that file).
3. `ratingService.fetchRating` checks the local cache first
   (`ratingsCache.ts`), otherwise sends a `RatingRequest` message to the
   background script and caches non-`NotFound` responses.
4. `background.ts` receives the message and calls `api.ts` —
   `fetchRatingFromVivino` (Vivino explore JSON API, with an HTML search-page
   fallback) or `fetchRatingFromUntappd` (scrapes Untappd search + detail HTML
   via cheerio).
5. `api.ts` scores candidates with `string-similarity`. Below the similarity
   threshold it returns `RatingResultStatus.Uncertain` (renders a "check
   manually" link) rather than a wrong rating; no candidate returns `NotFound`.
6. Back in `content.ts`, `handleRating` dispatches on `RatingResultStatus` and
   `domUtils.ts` renders the rating card (`#rating-container`) into the page.

**Popup** (`entrypoints/popup/`) is a plain HTML/TS toggle UI backed by the
three `sync:`-scoped storage items in `settings.ts` (`featuresEnabled`,
`wineFeatureEnabled`, `beerFeatureEnabled`, all default `true`). The content
script reads these before doing any work.

**Shared types** live in `src/@types/types.ts` — `ProductType` and
`RatingResultStatus` enums plus the `RatingRequest`/`RatingResponse` message
contract used across the process boundary.

**Caching** (`ratingsCache.ts`) uses `@wxt-dev/storage` with `local:` keys and
per-item metadata timestamps; entries expire after 1 day.

**i18n**: user-facing strings come from `src/locales/{sv,en}.yml` via
`@wxt-dev/i18n`; default locale is Swedish (`sv`). Use `i18n.t('key')`, not
hardcoded strings.

## Conventions

- Path alias `@/` maps to `src/` (WXT default).
- Object keys, imports, and union members are alpha-sorted — enforced by
  `eslint-plugin-perfectionist`; run `lint:fix` if you add members out of order.
- `no-console` is an error. eslint runs with `strictTypeChecked`, so `any`,
  floating promises, and unsafe access will fail the build.
- Manifest permissions and CSP are defined in `wxt.config.ts` (not a static
  manifest.json); localhost/WebSocket permissions are added only in dev builds.

## Testing notes

Playwright tests in `e2e/` load the built extension against the **live**
Systembolaget, Vivino, and Untappd sites (no mocking), so they depend on those
pages' current markup and can be flaky — CI retries twice and runs serially.
`fixtures.ts` provides the `extensionId` fixture. The `end-to-end.spec.ts`
tests must dismiss Systembolaget's age gate ("Jag har fyllt 20 år") and cookie
banner ("Acceptera alla kakor") before asserting on `#rating-container`.
