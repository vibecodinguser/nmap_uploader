import { resolve } from 'node:path'
import { loadEnv } from 'vite'
import { defineConfig } from 'wxt'
import { patchReactDomForAmo } from './lib/vite_patch_react_dom_amo'
import packageJson from './package.json'

const extensionIcons = {
  16: '/icon/16.png',
  32: '/icon/32.png',
  48: '/icon/48.png',
  128: '/icon/128.png',
} as const

const FIREFOX_EXTENSION_ID = 'nmap-uploader@local.dev'

const CHROME_PERMISSIONS = [
  'sidePanel',
  'storage',
  'scripting',
  'activeTab',
  'identity',
  'tabs',
] as const
const FIREFOX_PERMISSIONS = ['storage', 'scripting', 'activeTab', 'identity', 'tabs'] as const

const baseManifest = {
  name: 'nmap_uploader',
  version: packageJson.version,
  description: 'Загрузчик в Блокнот картографа Народной карты',
  host_permissions: [
    'https://n.maps.yandex.ru/*',
    'https://cloud-api.yandex.net/*',
    'https://*.disk.yandex.ru/*',
    'https://oauth.yandex.ru/*',
    'https://passport.yandex.ru/*',
    'https://login.yandex.ru/*',
    'https://avatars.yandex.net/*',
    'https://nakarte.me/*',
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
  vite: ({ mode }) => {
    const env = loadEnv(mode, import.meta.dirname, '')
    const releasesUrl = env.RELEASES_URL?.trim() ?? ''

    return {
      envPrefix: ['VITE_', 'WXT_', 'YANDEX_', 'RELEASES_'],
      plugins: [patchReactDomForAmo()],
      define: {
        __RELEASES_URL__: JSON.stringify(releasesUrl),
      },
      resolve: {
        // jszip/browser подменяет lib на browserify-бандл с setimmediate → Function().
        mainFields: ['module', 'jsnext', 'main'],
        alias: {
          setimmediate: resolve(import.meta.dirname, 'lib/setimmediate_shim.ts'),
        },
      },
      build: {
        modulePreload: { polyfill: false },
      },
    }
  },
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
  manifest: ({ browser, command }) => ({
    ...baseManifest,
    permissions: browser === 'firefox' ? [...FIREFOX_PERMISSIONS] : [...CHROME_PERMISSIONS],
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: FIREFOX_EXTENSION_ID,
          strict_min_version: '140.0',
          data_collection_permissions: {
            required: ['authenticationInfo', 'websiteContent'],
            optional: ['technicalAndInteraction'],
          },
        },
        gecko_android: {
          strict_min_version: '142.0',
        },
      },
    }),
    // key только для `pnpm dev`: стабильный extension id и OAuth redirect в Chrome.
    // В production ZIP для магазина key не включаем — иначе CWS отклоняет загрузку.
    ...(browser === 'chrome' &&
      command === 'serve' &&
      process.env.CHROME_EXTENSION_KEY && {
        key: process.env.CHROME_EXTENSION_KEY,
      }),
  }),
})
