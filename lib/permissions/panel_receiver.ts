import { browser } from 'wxt/browser'
import { isNmapsOrigin, NMAPS_ORIGIN } from '@/lib/extension_origins'
import { YANDEX_PERMISSION_REQUEST } from '@/lib/manifest/yandex_optional_hosts'

/**
 * Приёмник необязательных разрешений для страниц расширения.
 *
 * Панели расширения (`chrome-extension://…/panel.html`, `…/notes-panel.html`)
 * живут в iframe внутри `n.maps.yandex.ru`. Их инициатор-оригин — сайт
 * редактора, у которого нет доступа к `cloud-api.yandex.net`, поэтому
 * `permissions.request` из панели браузер отклоняет с «must be called during a
 * user gesture» или молча не показывает диалог.
 *
 * Контент-скрипт редактора — другое дело: он работает в контексте расширения
 * и видит те же домены, что и вкладка. Поэтому диалог браузера открывается
 * отсюда, а панель ждёт ответа. Приёмник получает только имя набора
 * разрешений из фиксированного списка и никогда не выдаёт ничего сверх
 * `YANDEX_PERMISSION_REQUEST`.
 */

export const PANEL_PERMISSION_REQUEST = 'yamapper:panel-permission-request'
export const PANEL_PERMISSION_RESPONSE = 'yamapper:panel-permission-response'

/** Наборы, которые панель вправе попросить. Всё прочее игнорируется. */
const ALLOWED_PERMISSION_SETS = {
  yandex: YANDEX_PERMISSION_REQUEST,
} as const

export type PermissionSetName = keyof typeof ALLOWED_PERMISSION_SETS

type PanelPermissionRequest = {
  source: typeof PANEL_PERMISSION_REQUEST
  set: PermissionSetName
  requestId: string
}

type PanelPermissionResponse = {
  source: typeof PANEL_PERMISSION_RESPONSE
  requestId: string
  granted: boolean
}

const isAllowedSet = (value: unknown): value is PermissionSetName =>
  typeof value === 'string' && Object.hasOwn(ALLOWED_PERMISSION_SETS, value)

const parseRequest = (data: unknown, origin: string): PanelPermissionRequest | null => {
  if (!isNmapsOrigin(origin)) return null
  const message = data as Partial<PanelPermissionRequest> | null | undefined
  if (message?.source !== PANEL_PERMISSION_REQUEST) return null
  if (!isAllowedSet(message.set)) return null
  if (typeof message.requestId !== 'string' || message.requestId === '') return null
  return {
    source: PANEL_PERMISSION_REQUEST,
    set: message.set,
    requestId: message.requestId,
  }
}

/**
 * Обрабатывает запрос и возвращает ответ, который нужно отправить панели.
 *
 * `permissions.request` обязан идти синхронно из обработчика события: браузер
 * считает жест пользователя действительным только в этом стеке вызовов.
 */
export const handlePanelPermissionRequest = async (
  message: PanelPermissionRequest,
): Promise<PanelPermissionResponse> => {
  let granted = false
  try {
    granted = await browser.permissions.request(ALLOWED_PERMISSION_SETS[message.set])
  } catch (error: unknown) {
    console.warn(`[yamapper] permissions.request(${message.set}) failed:`, error)
  }
  return { source: PANEL_PERMISSION_RESPONSE, requestId: message.requestId, granted }
}

/** Подписывается на запросы панелей и отвечает им в тот же window. */
export const installPanelPermissionReceiver = (): (() => void) => {
  const handleMessage = (event: MessageEvent): void => {
    const message = parseRequest(event.data, event.origin)
    if (!message || !event.source) return
    const source = event.source
    void handlePanelPermissionRequest(message).then((response) => {
      source.postMessage(response, { targetOrigin: NMAPS_ORIGIN })
    })
  }

  window.addEventListener('message', handleMessage)
  return () => window.removeEventListener('message', handleMessage)
}
