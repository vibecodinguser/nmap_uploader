import { defineConfig } from 'wxt'
import packageJson from './package.json'

const extensionIcons = {
  16: '/icon/16.png',
  32: '/icon/32.png',
  48: '/icon/48.png',
  128: '/icon/128.png',
} as const

const FIREFOX_EXTENSION_ID = 'nmap-uploader@local.dev'

const baseManifest = {
  name: 'nmap_uploader',
  version: packageJson.version,
  description: 'Загрузчик в Блокнот картографа Народной карты',
  permissions: ['sidePanel', 'storage', 'scripting', 'activeTab', 'identity', 'tabs'],
  host_permissions: [
    'https://n.maps.yandex.ru/*',
    'https://cloud-api.yandex.net/*',
    'https://*.disk.yandex.ru/*',
    'https://oauth.yandex.ru/*',
    'https://passport.yandex.ru/*',
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
} as const

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    build: {
      modulePreload: { polyfill: false },
    },
  }),
  webExt: {
    startUrls: [
      'https://n.maps.yandex.ru/#!/objects/3470560507?z=14&ll=39.187968%2C44.969538&l=nk%23sat',
    ],
    binaries: {
      chrome: '/Applications/Yandex.app/Contents/MacOS/Yandex',
    },
  },
  zip: {
    artifactTemplate: 'NmapUploader-{{browser}}_{{version}}.zip',
    sourcesTemplate: 'NmapUploader-{{browser}}_{{version}}-sources.zip',
  },
  manifest: ({ browser }) => ({
    ...baseManifest,
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: FIREFOX_EXTENSION_ID,
          strict_min_version: '109.0',
          data_collection_permissions: {
            required: ['authenticationInfo', 'websiteContent'],
            optional: ['technicalAndInteraction'],
          },
        },
      },
    }),
    ...(browser === 'chrome' &&
      process.env.CHROME_EXTENSION_KEY && {
        key: process.env.CHROME_EXTENSION_KEY,
      }),
  }),
})
