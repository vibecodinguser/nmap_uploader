import { resolve } from 'node:path'
import { loadEnv } from 'vite'
import { defineConfig } from 'wxt'
import { FIREFOX_EXTENSION_ID } from './lib/firefox_extension_id'
import { chromeDevManifestKey } from './lib/manifest/chrome_dev_key'
import {
  type ManifestWithPermissions,
  moveNspdHostPermissionsToOptional,
} from './lib/manifest/nspd_optional_hosts'
import { moveYandexPermissionsToOptional } from './lib/manifest/yandex_optional_hosts'
import { RELEASES_URL_DEFAULT } from './lib/releases_url'
import { patchReactDomForAmo } from './lib/vite_patch_react_dom_amo'
import packageJson from './package.json'

/*
 * Пауза перед пересборкой dev-сервера. Без неё каждое сохранение перезагружает
 * вкладку карты по разу на content script (их 15), и Яндекс начинает отвечать
 * 429 на свои же запросы. WXT читает переменную из process.env уже после
 * загрузки конфига, поэтому значение по умолчанию выставляется здесь;
 * переопределяется переменной окружения WXT_WATCH_DEBOUNCE.
 */
process.env.WXT_WATCH_DEBOUNCE ??= '1500'

const extensionIcons = {
  16: '/icon/16.png',
  32: '/icon/32.png',
  48: '/icon/48.png',
  128: '/icon/128.png',
} as const

const CHROME_PERMISSIONS = ['storage', 'scripting', 'activeTab', 'tabs'] as const
const FIREFOX_PERMISSIONS = ['storage', 'scripting', 'activeTab', 'tabs'] as const

const URI_SCHEME = 'https'

function manifestHostPattern(host: string): string {
  // biome-ignore lint/style/useTemplate: split '://' so analyzers do not treat '//' as a comment
  return URI_SCHEME + '://' + host
}

const MAPS_HOST = 'n.maps.yandex.ru'
const MAPS_START_PATH = '/#!/objects/3470560507?z=14&ll=39.187968%2C44.969538&l=nk%23sat'
// biome-ignore lint/style/useTemplate: split '://' so analyzers do not treat '//' as a comment
const MAPS_START_URL = URI_SCHEME + '://' + MAPS_HOST + MAPS_START_PATH

const baseManifest = {
  name: '__MSG_extName__',
  version: packageJson.version,
  description: '__MSG_extDescription__',
  default_locale: 'ru',
  /*
   * Обязательным остаётся только домен редактора: туда подключаются доки,
   * панели кнопок и приёмник разрешений. Домены Яндекса и `identity`
   * переносятся в необязательные хуком `moveYandexPermissionsToOptional` —
   * выдача запрашивается по кнопке, при включении «Блокнота» или «НСПД».
   */
  host_permissions: [
    manifestHostPattern('n.maps.yandex.ru/*'),
    manifestHostPattern('nakarte.me/*'),
  ],
  web_accessible_resources: [
    {
      resources: ['panel.html', 'polygon-upload.html', 'notes-panel.html', 'chunks/*', 'assets/*'],
      matches: [
        manifestHostPattern('n.maps.yandex.ru/*'),
        manifestHostPattern('nspd.gov.ru/*'),
        manifestHostPattern('*.nspd.gov.ru/*'),
      ],
    },
  ],
  action: {
    default_title: '__MSG_extName__',
    default_icon: extensionIcons,
  },
  icons: extensionIcons,
} as const

function getPermissions(browser: string) {
  let permissions: readonly (typeof CHROME_PERMISSIONS)[number][]
  if (browser === 'firefox') {
    permissions = FIREFOX_PERMISSIONS
  } else {
    permissions = CHROME_PERMISSIONS
  }
  return [...permissions]
}

function getFirefoxSettings(browser: string) {
  let settings = {}
  if (browser === 'firefox') {
    settings = {
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
    }
  }
  return settings
}

function buildManifest({ browser, command }: { browser: string; command: string }) {
  return {
    ...baseManifest,
    permissions: getPermissions(browser),
    ...getFirefoxSettings(browser),
    ...chromeDevManifestKey(browser, command),
  }
}

function configureVite({ mode }: { mode: string }) {
  const env = loadEnv(mode, import.meta.dirname, '')
  const releasesUrl = env.RELEASES_URL?.trim() || RELEASES_URL_DEFAULT

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
}

// noinspection JSUnusedGlobalSymbols
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: configureVite,
  dev: {
    /*
     * Порт 3000 только один. Без явного `port` WXT при занятом 3000 сам
     * берёт 3001 и пишет в ту же папку `.output/*-dev`: HTML-точки входа и
     * `background.js` начинают ссылаться на два разных сервера, и панель в
     * iframe грузится с мёртвого порта — правки не видны до перезапуска.
     * WXT при этом не перезаписывает HTML, который не менялся, поэтому
     * чужой порт остаётся в нём навсегда.
     *
     * `strictPort` действует только вместе с явным `port`: без него WXT
     * ищет свободный порт в диапазоне 3001–3010. С ними второй сервер
     * падает с ошибкой «порт занят» вместо тихой поломки сборки.
     */
    server: { port: 3000, strictPort: true },
  },
  hooks: {
    'build:manifestGenerated': (_wxt, manifest) => {
      moveYandexPermissionsToOptional(manifest as ManifestWithPermissions)
      moveNspdHostPermissionsToOptional(manifest as ManifestWithPermissions)
    },
  },
  webExt: {
    /*
     * Chrome 137+ и Яндекс.Браузер игнорируют `--load-extension`, поэтому
     * web-ext ставит dev-сборку CDP-командой `Extensions.loadUnpacked`. Такое
     * расширение навсегда выключается после `browser.runtime.reload()`, а WXT
     * вызывает его на каждую правку background, манифеста и общих модулей:
     * расширение «исчезало» из браузера, и помогала только перезагрузка
     * `pnpm dev`. Поэтому `pnpm dev:chrome` поднимает только сервер и просит
     * загрузить `.output/chrome-mv3-dev` вручную через `chrome://extensions`:
     * обычная unpacked-установка перезагружается штатно. Firefox (`pnpm dev`)
     * запускается как раньше — там перезагрузка расширения работает.
     */
    disabled: process.env.WXT_NO_BROWSER === '1',
    startUrls: [MAPS_START_URL],
    /*
     * Local Network Access: без этого панель не грузится в Firefox.
     *
     * Панель заметок — страница расширения в iframe внутри n.maps.yandex.ru,
     * то есть публичный сайт верхнего уровня. Firefox 160+ применяет к такому
     * запросу LNA (Local Network Access) и блокирует обращение к dev-серверу
     * http://localhost:3000 с вердиктом auto_deny: в консоли видно «Обнаружен
     * доступ к локальной сети… немедленное действие: auto_deny», и модули
     * @vite/client и main.tsx не загружаются — панель остаётся пустой.
     *
     * Для разработки это ровно наш случай и он безвреден: профиль временный на
     * один запуск, dev-сервер слушает только loopback. Поэтому фича выключена
     * в профиле разработки. Пользовательской сборки это не касается:
     * firefoxPref попадает только в профиль, который поднимает `pnpm dev`.
     *
     * network.lna.enabled — общий выключатель фичи
     * (modules/libpref/init/StaticPrefList.yaml). Одного blocking: false мало:
     * он снимает отказ, но проверки и запросы разрешений остаются.
     */
    firefoxPref: {
      'network.lna.enabled': false,
    },
    binaries: {
      firefox: '/Applications/Firefox.app/Contents/MacOS/firefox',
      chrome: '/Applications/Yandex.app/Contents/MacOS/Yandex',
    },
  },
  zip: {
    artifactTemplate: 'NmapUploader-{{browser}}_{{version}}.zip',
    sourcesTemplate: 'NmapUploader-{{browser}}_{{version}}-sources.zip',
  },
  manifest: buildManifest,
})
