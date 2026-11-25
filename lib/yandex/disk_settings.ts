import { browser } from 'wxt/browser'
import { PERMISSION_REQUIRED } from '@/lib/notes/storage/errors'
import { NOTES_BUTTON_ENABLED_STORAGE_KEY } from '@/lib/notes_button'
import { NSPD_BUTTON_ENABLED_STORAGE_KEY } from '@/lib/nspd/nspd_button'
import type { PermissionSetName } from '@/lib/permissions/panel_receiver'
import { requestPanelPermissions } from '@/lib/permissions/panel_requester'
import { hasYandexPermissions } from './permissions'

/**
 * Состояние доступа браузера к Яндексу и его запрос под клик.
 *
 * Оба тумблера в настройках включают функцию, которая работает только через
 * Диск: «Блокнот» сохраняет туда загрузки, «НСПД» — выгружает найденные
 * объекты. Поэтому при включении любого из них одним диалогом запрашиваются
 * разрешения Яндекса, а при выключении они не отзываются: иначе следующее
 * включение спрашивало бы разрешение и вход заново (ADR 0022).
 *
 * Ключи `notes_button_enabled` / `nspd_button_enabled` остаются прежними:
 * их читают кнопки на карте и синхронизация скриптов НСПД.
 */

export const YANDEX_DEPENDENT_SETTINGS = {
  notes: NOTES_BUTTON_ENABLED_STORAGE_KEY,
  nspd: NSPD_BUTTON_ENABLED_STORAGE_KEY,
} as const

export type YandexDependentSetting = keyof typeof YANDEX_DEPENDENT_SETTINGS

/** Включена ли хотя бы одна функция, которой нужен Диск. */
export const isYandexDiskFeatureEnabled = async (): Promise<boolean> => {
  const stored = await browser.storage.local.get(Object.values(YANDEX_DEPENDENT_SETTINGS))
  return Object.values(YANDEX_DEPENDENT_SETTINGS).some((key) => stored[key] === true)
}

/**
 * Просит разрешения Яндекса под клик пользователя.
 *
 * Вызывать строго из обработчика клика: жест браузера живёт один стек
 * вызовов, и между ним и `permissions.request` не должно быть сетевых
 * запросов. Возвращает `true`, если разрешения выданы (сразу или после
 * диалога).
 */
export const requestYandexAccess = async ({
  set = 'yandex',
}: {
  set?: PermissionSetName
} = {}): Promise<boolean> => {
  if (await hasYandexPermissions()) return true
  return requestPanelPermissions(set)
}

/**
 * Почему заметки или загрузка не работают, когда разрешений нет.
 *
 * Одна и та же константа и для фона, и для панели: по ней UI различает
 * «нажмите, чтобы разрешить» и «войдите в Яндекс».
 */
export { PERMISSION_REQUIRED }
