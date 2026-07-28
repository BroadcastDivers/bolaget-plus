import { defineConfig } from 'wxt'
const isProduction = process.env.NODE_ENV === 'production'
// See https://wxt.dev/api/config.html
export default defineConfig({
  dev: {
    server: {
      port: 3000
    }
  },
  manifest: {
    browser_specific_settings: {
      gecko: {
        id: 'broadcastdivers@test.com'
      },
      gecko_android: {
        strict_min_version: '120.0'
      }
    },
    content_security_policy: {
      extension_pages: `script-src 'self'; object-src 'self'; connect-src 'self' https://www.vivino.com https://images.vivino.com https://thumbs.vivino.com https://untappd.com https://9wbo4rq3ho-dsn.algolia.net https://9takgwjuxl-dsn.algolia.net${isProduction ? '' : ' ws://localhost:3000/'};`
    },
    default_locale: 'sv',

    host_permissions: [
      'https://www.systembolaget.se/*',
      'https://www.vivino.com/*',
      // Vivino serves label/bottle thumbnails from separate image hosts
      'https://images.vivino.com/*',
      'https://thumbs.vivino.com/*',
      'https://untappd.com/*',
      // Untappd's Algolia search index, used for beer lookups
      'https://9wbo4rq3ho-dsn.algolia.net/*',
      // Vivino's Algolia search index, used for wine lookups
      'https://9takgwjuxl-dsn.algolia.net/*'
    ],
    icons: {
      16: 'icons/16.png',
      32: 'icons/32.png',
      48: 'icons/48.png',
      128: 'icons/128.png'
    },
    permissions: [
      'storage',
      // Drives the hourly expired-ratings cache sweep.
      'alarms',
      '*://*.vivino.com/*',
      '*://*.untappd.com/*',
      'clipboardWrite',
      // Conditionally include permissions based on the build environment
      ...(isProduction ? [] : ['ws://localhost:3000/'])
    ]
  },
  modules: ['@wxt-dev/auto-icons', '@wxt-dev/i18n/module'],
  srcDir: 'src',
  webExt: {
    startUrls: [
      'about:debugging#/runtime/this-firefox',
      'https://www.systembolaget.se/produkt/vin/onbrina-796501/',
      'chrome://extensions/'
    ]
  }
})
