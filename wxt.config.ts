import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'wxt'

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
    build: {
      modulePreload: { polyfill: false },
    },
  }),
  runner: {
    binaries: {
      chrome: '/Applications/Yandex.app/Contents/MacOS/Yandex',
    },
  },
  manifest: {
    name: 'nmap_uploader',
    description: 'Загрузка геоданных в Блокнот картографа Народной карты',
    permissions: ['sidePanel', 'storage', 'scripting', 'activeTab'],
    host_permissions: ['<all_urls>'],
    web_accessible_resources: [
      {
        resources: ['panel.html', 'chunks/*', 'assets/*'],
        matches: ['<all_urls>'],
      },
    ],
    action: {
      default_title: 'nmap_uploader',
      default_icon: {
        16: '/icon/16.png',
        32: '/icon/32.png',
        48: '/icon/48.png',
        128: '/icon/128.png',
      },
    },
    icons: {
      16: '/favicon.svg',
      32: '/favicon.svg',
      48: '/favicon.svg',
      128: '/favicon.svg',
    },
  },
})