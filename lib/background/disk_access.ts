import {
  AUTH_REQUIRED,
  type DiskAccessError,
  PERMISSION_REQUIRED,
} from '@/lib/notes/storage/errors'
import { hasYandexPermissions } from '@/lib/yandex/permissions'
import { getStoredAuth } from '@/lib/yandex/storage'

/**
 * Доступ к Диску для фоновых обработчиков: токен или причина отказа.
 *
 * Фон не может выдать разрешения браузера сам — это делает только клик
 * пользователя. Поэтому без разрешений он отвечает `PERMISSION_REQUIRED`, а
 * панель показывает «нажмите, чтобы разрешить». Если разрешения есть, но
 * входа нет — `AUTH_REQUIRED`.
 */
export type DiskAccessResult =
  | { ok: true; token: string; userId: string }
  | { ok: false; error: DiskAccessError }

export const resolveDiskAccess = async (): Promise<DiskAccessResult> => {
  if (!(await hasYandexPermissions())) {
    return { ok: false, error: PERMISSION_REQUIRED }
  }

  const auth = await getStoredAuth()
  if (!auth) {
    return { ok: false, error: AUTH_REQUIRED }
  }

  return { ok: true, token: auth.token, userId: auth.user.id }
}
