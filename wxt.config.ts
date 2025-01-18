import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
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
      16: 'icon/icon.png',
      32: 'icon/icon.png',
      48: 'icon/icon.png',
      96: 'icon/icon.png',
      128: 'icon/icon.png',
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
