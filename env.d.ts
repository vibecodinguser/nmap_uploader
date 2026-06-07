interface ImportMetaEnv {
  readonly BROWSER?: 'chrome' | 'firefox' | 'safari' | 'edge'
  readonly YANDEX_CLIENT_ID?: string
  readonly YANDEX_REDIRECT_URI?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
