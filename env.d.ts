interface ImportMetaEnv {
  readonly BROWSER?: 'chrome' | 'firefox' | 'safari' | 'edge';
  readonly YANDEX_CLIENT_ID?: string;
  readonly YANDEX_REDIRECT_URI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

type ReleasesUrlDefine = string;

/** URL релизов из .env — подставляется в wxt.config.ts через define. */
declare const __RELEASES_URL__: ReleasesUrlDefine;
