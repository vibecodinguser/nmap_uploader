import { browser } from 'wxt/browser'
import { NMAPS_ORIGIN } from '@/lib/extension_origins'
import { YANDEX_PERMISSION_REQUEST } from '@/lib/manifest/yandex_optional_hosts'
import {
  PANEL_PERMISSION_REQUEST,
  PANEL_PERMISSION_RESPONSE,
  type PermissionSetName,
} from '@/lib/permissions/panel_receiver'
import { hasYandexPermissions } from '@/lib/yandex/permissions'

/**
 * Запрос необязательных разрешений из страницы расширения.
 *
 * Панель в iframe редактора не может вызвать `permissions.request` сама:
 * её инициатор — сайт карты, у которого нет доступа к `cloud-api.yandex.net`.
 * Диалог открывает контент-скрипт редактора (`lib/permissions/panel_receiver`),
 * а панель только просит и ждёт ответа.
 *
 * Вызывать из обработчика клика: жест пользователя должен дойти до
 * `permissions.request` в content scriptовом контексте — окно, через которое
 * идёт `postMessage`, считается активным только внутри обработчика события.
 */

/** Сколько ждём ответа контент-скрипта: больше, чем пользователь смотрит диалог. */
const PERMISSION_RESPONSE_TIMEOUT_MS = 120_000

type PendingRequest = {
  resolve: (granted: boolean) => void
  timeoutId: number
}

const pendingRequests = new Map<string, PendingRequest>()

let isListenerInstalled = false

const settle = (requestId: string, granted: boolean): void => {
  const pending = pendingRequests.get(requestId)
  if (!pending) return
  pendingRequests.delete(requestId)
  window.clearTimeout(pending.timeoutId)
  pending.resolve(granted)
}

const handlePermissionResponse = (event: MessageEvent): void => {
  if (event.origin !== NMAPS_ORIGIN) return
  const data = event.data as
    | { source?: unknown; requestId?: unknown; granted?: unknown }
    | null
    | undefined
  if (data?.source !== PANEL_PERMISSION_RESPONSE) return
  if (typeof data.requestId !== 'string') return
  settle(data.requestId, data.granted === true)
}

const ensureResponseListener = (): void => {
  if (isListenerInstalled) return
  isListenerInstalled = true
  window.addEventListener('message', handlePermissionResponse)
}

const createRequestId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

/**
 * Просит набор разрешений и возвращает, выдан ли он.
 *
 * Если контент-скрипта редактора нет (панель открыта вне карты), запрос
 * `permissions.request` делается напрямую: тогда инициатор — сама страница
 * расширения, и это работает.
 */
export const requestPanelPermissions = async (set: PermissionSetName): Promise<boolean> => {
  if (window.parent === window) {
    return browser.permissions.request(YANDEX_PERMISSION_REQUEST)
  }

  ensureResponseListener()
  const requestId = createRequestId()

  const granted = await new Promise<boolean>((resolve) => {
    const timeoutId = window.setTimeout(
      () => settle(requestId, false),
      PERMISSION_RESPONSE_TIMEOUT_MS,
    )
    pendingRequests.set(requestId, { resolve, timeoutId })
    window.parent.postMessage({ source: PANEL_PERMISSION_REQUEST, set, requestId }, NMAPS_ORIGIN)
  })

  return granted
}

/** Выданы ли разрешения Яндекса прямо сейчас. */
export const isYandexPermissionGranted = hasYandexPermissions
