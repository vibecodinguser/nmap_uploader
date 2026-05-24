import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'wxt'

const extensionIcons = {
  16: '/icon/16.png',
  32: '/icon/32.png',
  48: '/icon/48.png',
  128: '/icon/128.png',
} as const

// WXT загружает конфиг при сборке; статического import нет
// noinspection JSUnusedGlobalSymbols
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
    build: {
      modulePreload: { polyfill: false },
    },
  }),
  webExt: {
    binaries: {
      chrome: '/Applications/Yandex.app/Contents/MacOS/Yandex',
    },
  },
  manifest: {
    name: 'nmap_uploader',
    description: 'Загрузка геоданных в Блокнот картографа Народной карты',
    permissions: ['sidePanel', 'storage', 'scripting', 'activeTab', 'identity'],
    host_permissions: [
      '<all_urls>',
      'https://cloud-api.yandex.net/*',
      'https://oauth.yandex.ru/*',
      'https://login.yandex.ru/*',
    ],
    web_accessible_resources: [
      {
        resources: ['panel.html', 'chunks/*', 'assets/*'],
        matches: ['<all_urls>'],
      },
    ],
    action: {
      default_title: 'nmap_uploader',
      default_icon: extensionIcons,
    },
    icons: extensionIcons,
  },
})
