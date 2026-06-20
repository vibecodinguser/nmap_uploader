import { resolve } from 'node:path';
import { loadEnv } from 'vite';
import { defineConfig } from 'wxt';
import { FIREFOX_EXTENSION_ID } from './lib/firefox_extension_id';
import { patchReactDomForAmo } from './lib/vite_patch_react_dom_amo';
import packageJson from './package.json';

const extensionIcons = {
  16: '/icon/16.png',
  32: '/icon/32.png',
  48: '/icon/48.png',
  128: '/icon/128.png',
} as const;

const CHROME_PERMISSIONS = [
  'sidePanel',
  'storage',
  'scripting',
  'activeTab',
  'identity',
  'tabs',
] as const;
const FIREFOX_PERMISSIONS = ['storage', 'scripting', 'activeTab', 'identity', 'tabs'] as const;

const URI_SCHEME = 'https';

function manifestHostPattern(host: string): string {
  // biome-ignore lint/style/useTemplate: split '://' so analyzers do not treat '//' as a comment
  return URI_SCHEME + '://' + host;
}

const MAPS_HOST = 'n.maps.yandex.ru';
const MAPS_START_PATH = '/#!/objects/3470560507?z=14&ll=39.187968%2C44.969538&l=nk%23sat';
// biome-ignore lint/style/useTemplate: split '://' so analyzers do not treat '//' as a comment
const MAPS_START_URL = URI_SCHEME + '://' + MAPS_HOST + MAPS_START_PATH;

const baseManifest = {
  name: '__MSG_extName__',
  version: packageJson.version,
  description: '__MSG_extDescription__',
  default_locale: 'ru',
  host_permissions: [
    manifestHostPattern('n.maps.yandex.ru/*'),
    manifestHostPattern('cloud-api.yandex.net/*'),
    manifestHostPattern('*.disk.yandex.ru/*'),
    manifestHostPattern('oauth.yandex.ru/*'),
    manifestHostPattern('passport.yandex.ru/*'),
    manifestHostPattern('login.yandex.ru/*'),
    manifestHostPattern('avatars.yandex.net/*'),
    manifestHostPattern('nakarte.me/*'),
  ],
  web_accessible_resources: [
    {
      resources: ['panel.html', 'chunks/*', 'assets/*'],
      matches: [manifestHostPattern('n.maps.yandex.ru/*')],
    },
  ],
  action: {
    default_title: '__MSG_extName__',
    default_icon: extensionIcons,
  },
  icons: extensionIcons,
} as const;

function getPermissions(browser: string) {
  let permissions: readonly (typeof CHROME_PERMISSIONS)[number][];
  if (browser === 'firefox') {
    permissions = FIREFOX_PERMISSIONS;
  } else {
    permissions = CHROME_PERMISSIONS;
  }
  return [...permissions];
}

function getFirefoxSettings(browser: string) {
  let settings = {};
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
    };
  }
  return settings;
}

function getChromeDevKey(browser: string, command: string) {
  let keySettings = {};
  if (browser === 'chrome' && command === 'serve' && process.env.CHROME_EXTENSION_KEY) {
    keySettings = { key: process.env.CHROME_EXTENSION_KEY };
  }
  return keySettings;
}

function buildManifest({ browser, command }: { browser: string; command: string }) {
  return {
    ...baseManifest,
    permissions: getPermissions(browser),
    ...getFirefoxSettings(browser),
    // key только для `pnpm dev`: стабильный extension id и OAuth redirect в Chrome.
    // В production ZIP для магазина key не включаем — иначе CWS отклоняет загрузку.
    ...getChromeDevKey(browser, command),
  };
}

function configureVite({ mode }: { mode: string }) {
  const env = loadEnv(mode, import.meta.dirname, '');
  const releasesUrl = env.RELEASES_URL?.trim() ?? '';

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
  };
}

// noinspection JSUnusedGlobalSymbols
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: configureVite,
  webExt: {
    startUrls: [MAPS_START_URL],
    binaries: {
      chrome: '/Applications/Yandex.app/Contents/MacOS/Yandex',
    },
  },
  zip: {
    artifactTemplate: 'NmapUploader-{{browser}}_{{version}}.zip',
    sourcesTemplate: 'NmapUploader-{{browser}}_{{version}}-sources.zip',
  },
  manifest: buildManifest,
});
