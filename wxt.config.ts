import { defineConfig } from 'wxt'
const isProduction = process.env.NODE_ENV === 'production'
// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/auto-icons', '@wxt-dev/i18n/module'],
  runner: {
    startUrls: [
      'about:debugging#/runtime/this-firefox',
      'https://www.systembolaget.se/produkt/vin/onbrina-796501/',
      'chrome://extensions/'
    ]
  },
  dev: {
    server: {
      port: 3000
    }
  },
  extensionApi: 'webextension-polyfill',
  srcDir: 'src',
  manifest: {
    default_locale: 'sv',
    icons: {
      16: 'icons/16.png',
      32: 'icons/32.png',
      48: 'icons/48.png',
      128: 'icons/128.png'
    },
    permissions: [
      'storage',
      '*://*.vivino.com/*',
      '*://*.untappd.com/*',
      'clipboardWrite',
      // Conditionally include permissions based on the build environment
      ...(isProduction ? [] : ['ws://localhost:3000/'])
    ],

    host_permissions: [
      'https://www.systembolaget.se/*',
      'https://www.vivino.com/*',
      'https://untappd.com/*'
    ],
    content_security_policy: {
      extension_pages: `script-src 'self'; object-src 'self'; connect-src 'self' https://www.vivino.com https://untappd.com${isProduction ? '' : ' ws://localhost:3000/'};`
    },
    browser_specific_settings: {
      gecko: {
        id: 'broadcastdivers@test.com'
      },
      gecko_android : {
        strict_min_version: '120.0'
      }
    }
  }
})
