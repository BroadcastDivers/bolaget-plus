# Bolaget+

[![GitHub Release](https://img.shields.io/github/release/BroadcastDivers/bolaget-plus.svg?style=flat)]() [![Playwright Tests](https://github.com/BroadcastDivers/bolaget-plus/actions/workflows/playwright.yml/badge.svg)](https://github.com/BroadcastDivers/bolaget-plus/actions/workflows/playwright.yml)

A browser plugin for Systembolaget.se that shows ratings directly at systembolagets website!

![screenshot](header.jpg)

## Features

- Seamless integration with Systembolaget's website
- Wine ratings from [Vivino](https://www.vivino.com/) with direct links to product pages
- Beer ratings from [Untappd](https://untappd.com/) with direct links to product pages
- Easy toggling of features through a simple popup interface
- Works with both Firefox and Chrome browsers

## Installation

[![Download Firefox Extension](https://img.shields.io/badge/Download-Firefox%20Extension-orange?logo=firefox)](https://addons.mozilla.org/firefox/addon/bolaget-plus) [![Download Chrome Extension](https://img.shields.io/badge/Download-Chrome%20Extension-blue?logo=google-chrome)](https://chromewebstore.google.com/detail/bolaget-plus/bbjfkhmnofhindccdlfmhkibfafiogao)

Or download the latest zip from the [Github Releases](https://github.com/BroadcastDivers/bolaget-plus/releases) page and install it in your browser.

## Usage

1. Install the extension from the Firefox Add-ons or Chrome Web Store.
2. Navigate to the Systembolaget website.
3. Browse products as usual. Ratings will be displayed on the product pages.
4. Use the extension popup to:
   - Disable wine ratings.
   - Disable beer ratings.
   - Disable the extension entirely.

## Development

Install dependencies with [pnpm](https://pnpm.io/)

```sh
pnpm install
# Git hooks will be automatically installed
```

Run it in either Chrome or Firefox:

```sh
pnpm dev:firefox
pnpm dev:chrome
```

### Testing

Run the tests with:

```sh
pnpm test
```

### Building

Build the extension locally:

```sh
pnpm build
```

The output is located in the `.output` folder.

## License

This project is licensed under the [MIT License](LICENSE) - see the LICENSE file for details.

## Framework

This extension is built using the WXT framework. Learn more about [WXT](https://wxt.dev/guide/essentials/project-structure) here.
