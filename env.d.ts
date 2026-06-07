interface ImportMetaEnv {
  readonly BROWSER?: 'chrome' | 'firefox' | 'safari' | 'edge'
  readonly YANDEX_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
