import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'wxt'

const extensionIcons = {
  16: '/icon/16.png',
  32: '/icon/32.png',
  48: '/icon/48.png',
  128: '/icon/128.png',
} as const

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
    description: 'Загрузчик в Блокнот картографа Народной карты',
    permissions: ['sidePanel', 'storage', 'scripting', 'activeTab', 'identity', 'tabs'],
    host_permissions: [
      'https://n.maps.yandex.ru/*',
      'https://cloud-api.yandex.net/*',
      'https://*.disk.yandex.ru/*',
      'https://oauth.yandex.ru/*',
      'https://login.yandex.ru/*',
      'https://avatars.yandex.net/*',
    ],
    web_accessible_resources: [
      {
        resources: ['panel.html', 'chunks/*', 'assets/*'],
        matches: ['https://n.maps.yandex.ru/*'],
      },
    ],
    action: {
      default_title: 'nmap_uploader',
      default_icon: extensionIcons,
    },
    icons: extensionIcons,
  },
})
