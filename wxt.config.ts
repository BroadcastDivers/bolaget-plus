import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/auto-icons'],
  runner: {
    startUrls: [
      'about:debugging#/runtime/this-firefox',
      'https://www.systembolaget.se/produkt/vin/onbrina-796501/',
      'chrome://extensions/',
    ],
  },
  dev: {
    server: {
      port: 3000,
    },
  },
  extensionApi: 'webextension-polyfill',
  srcDir: 'src',
  manifest: {
    icons: {
      16: 'icons/16.png',
      32: 'icons/32.png',
      48: 'icons/48.png',
      96: 'icons/96.png',
      128: 'icons/128.png',
    },
    permissions: [
      'activeTab',
      'storage',
      'webRequest',
      '*://*.vivino.com/*',
      '*://*.untappd.com/*',
      'clipboardWrite',
      'ws://localhost:3000/',
    ],
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'self'; connect-src ws://localhost:3000/ 'self' https://www.vivino.com https://untappd.com;",
    },
    browser_specific_settings: {
      gecko: {
        id: 'broadcastdivers@test.com',
      },
    },
  },
});
