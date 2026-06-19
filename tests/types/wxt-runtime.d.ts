// noinspection JSUnusedGlobalSymbols
import 'wxt/browser'

declare module 'wxt/browser' {
  interface WxtRuntime {
    getURL(path: string): string
  }
}
