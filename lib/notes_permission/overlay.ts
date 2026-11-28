import { browser } from 'wxt/browser'
import { markNmapOwned } from '@/lib/go_to/ownership'
import { hideGoToTooltip, showGoToTooltip } from '@/lib/go_to_dom'
import { GO_TO_BUTTON_HOVERED_CLASS } from '@/lib/go_to_styles'
import {
  GET_YANDEX_PERMISSIONS_ACTION,
  NOTES_PERMISSION_CLICKED_MESSAGE,
  NOTES_PERMISSION_DENIED_MESSAGE,
  NOTES_PERMISSION_GRANTED_MESSAGE,
  NOTES_PERMISSION_HOVER_MESSAGE,
  NOTES_PERMISSION_OVERLAY_ID,
  NOTES_PERMISSION_READY_MESSAGE,
  YANDEX_PERMISSIONS_CHANGED_ACTION,
} from './protocol'

/**
 * Прозрачный оверлей над кнопкой заметок, пока нет разрешений Яндекса.
 *
 * `permissions.request` в контент-скрипте недоступен, а жест клика не
 * переживает передачу в фон или в iframe панели. Единственный способ спросить
 * разрешения ровно по клику по кнопке — положить поверх неё страницу
 * расширения: клик попадает в неё, и она сама открывает диалог браузера.
 *
 * Оверлей существует только в состоянии «разрешений нет»: после выдачи он
 * снимается, а обычный путь (кнопка → панель) остаётся прежним.
 */

/** Как часто сверять положение оверлея с кнопкой: тулбар перерисовывается редактором. */
const POSITION_SYNC_INTERVAL_MS = 500
/** Выше кнопок карты, но ниже подсказок, меню и панели заметок. */
const OVERLAY_Z_INDEX = '9999'
/**
 * Сколько ждать подтверждения, что страница оверлея загрузилась.
 *
 * Невидимый iframe с неудачной загрузкой — это мёртвая зона над кнопкой:
 * клик не доходит ни до страницы, ни до кнопки. Поэтому без подтверждения
 * оверлей снимается, и кнопка снова работает по-старому.
 */
const READY_TIMEOUT_MS = 5000

type OverlayContext = {
  /** Подпись всплывающей подсказки у кнопки. */
  getLabel: () => string
  /** Ответ на диалог получен: дальше решает вызывающая сторона. */
  onResolved: () => void
}

let context: OverlayContext = {
  getLabel: () => '',
  onResolved: () => {},
}
let frame: HTMLIFrameElement | null = null
let target: HTMLButtonElement | null = null
/** `null` — ещё не спросили фон; `false` — разрешений нет, оверлей нужен. */
let granted: boolean | null = null
/** Кликнули по оверлею: панель нужно открыть, когда придёт ответ на диалог. */
let clicked = false
let subscribed = false
let positionTimer: number | null = null
let readyTimer: number | null = null
let queryInFlight = false
/**
 * Страница оверлея не загрузилась: до перезагрузки страницы карты кнопка
 * работает без оверлея, а панель показывает «Разрешить доступ».
 */
let overlayUnavailable = false

const getFrameUrl = (): string | null => {
  try {
    return browser.runtime.getURL('/notes-permission.html')
  } catch {
    // Контекст расширения мог быть инвалидирован при перезагрузке — тогда
    // оверлея просто не будет.
    return null
  }
}

const stopPositionTimer = (): void => {
  if (positionTimer === null) return
  window.clearInterval(positionTimer)
  positionTimer = null
}

const stopReadyTimer = (): void => {
  if (readyTimer === null) return
  window.clearTimeout(readyTimer)
  readyTimer = null
}

const startPositionTimer = (): void => {
  if (positionTimer !== null) return
  positionTimer = window.setInterval(syncPosition, POSITION_SYNC_INTERVAL_MS)
}

function syncPosition(): void {
  if (!frame) return
  const button = target
  if (!button?.isConnected) {
    removeFrame()
    return
  }

  const rect = button.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) {
    frame.style.visibility = 'hidden'
    return
  }

  frame.style.visibility = 'visible'
  frame.style.left = `${rect.left}px`
  frame.style.top = `${rect.top}px`
  frame.style.width = `${rect.width}px`
  frame.style.height = `${rect.height}px`
}

function removeFrame(): void {
  stopPositionTimer()
  stopReadyTimer()
  frame?.remove()
  frame = null
  clicked = false
  if (target) target.classList.remove(GO_TO_BUTTON_HOVERED_CLASS)
  hideGoToTooltip()
}

function ensureFrame(): void {
  if (frame || granted !== false || overlayUnavailable) return
  const button = target
  if (!button?.isConnected) return

  const url = getFrameUrl()
  if (!url) return

  const created = document.createElement('iframe')
  created.id = NOTES_PERMISSION_OVERLAY_ID
  // Кнопка остаётся доступной с клавиатуры и для скринридера: оверлей — это
  // только приёмник клика мышью, а не второй элемент управления.
  created.tabIndex = -1
  created.setAttribute('aria-hidden', 'true')
  created.src = url
  created.style.position = 'fixed'
  created.style.zIndex = OVERLAY_Z_INDEX
  created.style.display = 'block'
  created.style.margin = '0'
  created.style.padding = '0'
  created.style.border = '0'
  created.style.background = 'transparent'
  created.style.pointerEvents = 'auto'
  created.style.outline = 'none'
  created.style.boxShadow = 'none'
  created.style.borderRadius = '0'
  created.style.overflow = 'hidden'
  created.style.maxWidth = 'none'
  created.style.maxHeight = 'none'
  /*
   * Полная прозрачность, а не «прозрачный фон внутри документа»: внешний вид
   * iframe не должен зависеть от того, как браузер отрисует чужой документ
   * (фон, дефолтная кнопка внутри, страница ошибки). Клики при `opacity: 0`
   * доходят до документа, поэтому жест для `permissions.request` сохраняется.
   */
  created.style.opacity = '0'
  created.style.visibility = 'hidden'

  markNmapOwned(created)
  document.documentElement.appendChild(created)
  frame = created
  syncPosition()
  startPositionTimer()

  stopReadyTimer()
  readyTimer = window.setTimeout(() => {
    readyTimer = null
    if (!frame) return
    overlayUnavailable = true
    removeFrame()
  }, READY_TIMEOUT_MS)
}

/**
 * Разрешения выданы. Панель открывается только если по оверлею кликнули:
 * выдача из настроек, пока оверлей лежит на кнопке, панель не открывает.
 */
function resolveGranted(): void {
  const shouldOpen = clicked
  granted = true
  removeFrame()
  if (shouldOpen) context.onResolved()
}

function applyGranted(next: boolean): void {
  if (next) {
    resolveGranted()
    return
  }
  granted = false
  ensureFrame()
}

function handleWindowMessage(event: MessageEvent): void {
  if (!frame || event.source !== frame.contentWindow) return

  const data = event.data as { action?: string; hovered?: boolean } | null | undefined
  switch (data?.action) {
    case NOTES_PERMISSION_READY_MESSAGE:
      stopReadyTimer()
      return
    case NOTES_PERMISSION_CLICKED_MESSAGE:
      clicked = true
      return
    case NOTES_PERMISSION_HOVER_MESSAGE: {
      const button = target
      if (!button?.isConnected) return
      if (data.hovered) {
        button.classList.add(GO_TO_BUTTON_HOVERED_CLASS)
        showGoToTooltip(context.getLabel(), button, 'top')
      } else {
        button.classList.remove(GO_TO_BUTTON_HOVERED_CLASS)
        hideGoToTooltip()
      }
      return
    }
    case NOTES_PERMISSION_GRANTED_MESSAGE:
      resolveGranted()
      return
    case NOTES_PERMISSION_DENIED_MESSAGE:
      // `granted` остаётся `false`: следующий клик снова откроет диалог, а
      // панель тем временем показывает кнопку «Разрешить доступ».
      removeFrame()
      context.onResolved()
      return
    default:
      return
  }
}

const handleRuntimeMessage = (message: { action?: string; granted?: unknown }): void => {
  if (message?.action !== YANDEX_PERMISSIONS_CHANGED_ACTION) return
  if (typeof message.granted !== 'boolean') return
  applyGranted(message.granted)
}

const handleViewportChange = (): void => {
  syncPosition()
}

function ensureSubscribed(): void {
  if (subscribed) return
  subscribed = true
  window.addEventListener('message', handleWindowMessage)
  window.addEventListener('resize', handleViewportChange)
  window.addEventListener('scroll', handleViewportChange, true)
  browser.runtime.onMessage.addListener(handleRuntimeMessage)
}

function queryGranted(): void {
  if (queryInFlight) return
  queryInFlight = true
  browser.runtime
    .sendMessage({ action: GET_YANDEX_PERMISSIONS_ACTION })
    .then((response: unknown) => {
      const payload = response as { granted?: unknown } | undefined
      if (typeof payload?.granted === 'boolean') applyGranted(payload.granted)
    })
    .catch(() => {
      // Без ответа фона оверлей не появится: кнопка откроет панель, а панель
      // покажет «Разрешить доступ» — тот же сценарий, что был до оверлея.
    })
    .finally(() => {
      queryInFlight = false
    })
}

/**
 * Привязывает оверлей к актуальной кнопке заметок.
 *
 * Вызывается при каждой сборке тулбара: кнопка пересоздаётся редактором, а
 * состояние разрешений меняется без перезагрузки страницы.
 */
export const syncNotesPermissionOverlay = (
  button: HTMLButtonElement | null,
  nextContext?: Partial<OverlayContext>,
): void => {
  if (nextContext) context = { ...context, ...nextContext }

  if (target !== button) {
    if (target) target.classList.remove(GO_TO_BUTTON_HOVERED_CLASS)
    hideGoToTooltip()
  }
  target = button

  if (!button) {
    removeFrame()
    return
  }

  ensureSubscribed()

  if (granted === null) {
    queryGranted()
    return
  }
  if (granted) {
    removeFrame()
    return
  }
  ensureFrame()
}

/** Снимает оверлей и подписки: вызывается при остановке контент-скрипта. */
export const destroyNotesPermissionOverlay = (): void => {
  removeFrame()
  target = null
  granted = null
  queryInFlight = false
  overlayUnavailable = false
  if (!subscribed) return

  subscribed = false
  window.removeEventListener('message', handleWindowMessage)
  window.removeEventListener('resize', handleViewportChange)
  window.removeEventListener('scroll', handleViewportChange, true)
  try {
    browser.runtime.onMessage.removeListener(handleRuntimeMessage)
  } catch {
    // Контекст расширения уже инвалидирован — подписка умерла вместе с ним.
  }
}
