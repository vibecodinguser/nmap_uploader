import { browser } from 'wxt/browser'
import { YANDEX_PERMISSION_REQUEST } from '@/lib/manifest/yandex_optional_hosts'

type YandexPermissionState = 'granted' | 'denied' | 'unknown'

/**
 * Выданы ли расширению разрешения на домены Яндекса и `identity`.
 *
 * `unknown` — API разрешений недоступен или бросил ошибку: в этом случае
 * состояние не трогаем, иначе сбой чтения молча выключал бы функции и
 * предлагал заново пройти вход.
 */
export const readYandexPermissionState = async (): Promise<YandexPermissionState> => {
  try {
    const granted = await browser.permissions.contains(YANDEX_PERMISSION_REQUEST)
    return granted ? 'granted' : 'denied'
  } catch (error: unknown) {
    console.warn('[yamapper] yandex permissions.contains failed:', error)
    return 'unknown'
  }
}

/** Выданы ли разрешения Яндекса; ошибка API считается отказом. */
export const hasYandexPermissions = async (): Promise<boolean> =>
  (await readYandexPermissionState()) === 'granted'
