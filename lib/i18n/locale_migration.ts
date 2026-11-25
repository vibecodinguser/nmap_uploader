import { browser } from 'wxt/browser'

/** Прежний пользовательский язык: с ADR 0021 язык следует за редактором. */
export const LEGACY_LOCALE_STORAGE_KEY = 'locale'

/**
 * Убирает ключ ручного языка из хранилища.
 *
 * Читать его больше некому: язык берётся из редактора. Ключ удаляется один раз
 * при старте, чтобы он не висел в `storage.local` вечным мусором.
 */
export const removeLegacyLocaleSetting = async (): Promise<void> => {
  await browser.storage.local.remove(LEGACY_LOCALE_STORAGE_KEY)
}
