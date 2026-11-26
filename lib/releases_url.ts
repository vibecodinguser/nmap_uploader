/**
 * Ссылка на страницу релизов в блоке «О версии» панели.
 *
 * Значение по умолчанию живёт здесь, а не в `.env`: без него ссылка в настройках
 * была пустой на чистом клоне. Переопределяется переменной `RELEASES_URL`
 * (`wxt.config.ts` подставляет её в сборку через `define`).
 */
export const RELEASES_URL_DEFAULT = 'https://github.com/vibecodinguser/yamapper/releases/latest'

export const RELEASES_URL: string =
  typeof __RELEASES_URL__ !== 'undefined' && __RELEASES_URL__ !== ''
    ? __RELEASES_URL__
    : RELEASES_URL_DEFAULT
