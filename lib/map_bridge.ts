/**
 * Центрирование карты и дата трекера.
 *
 * Раньше эти обработчики жили в контент-скрипте панели настроек: панель была
 * единственным интерфейсом, который о них просил. С попапом так нельзя —
 * заметки и загрузка точек работают и при закрытых настройках, поэтому мост
 * живёт отдельным скриптом и от видимости попапа не зависит.
 */
import { browser } from 'wxt/browser'
import {
  NMAPS_POINT_PICKED_EVENT,
  notifyCancelPickPoint,
  notifyStartPickPoint,
  parsePointPickedEvent,
} from '@/lib/nmaps_pick_point_notify'
import {
  CANCEL_POINT_PICKING_ACTION,
  POINT_PICKED_ACTION,
  START_POINT_PICKING_ACTION,
} from '@/lib/pick_point_action'

type CenterMapParams = {
  latitude: number
  longitude: number
  zoom: number
}

/** Ограничения редактора: дальше 18 зум не осмыслен. */
const MAX_ZOOM = 18
const MIN_ZOOM = 2

/**
 * Приблизительный зум по bounding box.
 *
 * `panelWidth` — место, которое занимает интерфейс поверх карты. У настроек
 * его больше нет: попап карту не перекрывает, поэтому считается вся ширина.
 */
export const calculateZoomFromBbox = (
  bbox: number[],
  windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1280,
  windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800,
  panelWidth = 0,
): number => {
  const [minLon, minLat, maxLon, maxLat] = bbox
  const width = windowWidth - panelWidth - 40 // 40 margin
  const height = windowHeight - 80 // 80 margin

  let zoomX = MAX_ZOOM
  let zoomY = MAX_ZOOM

  if (width > 0 && height > 0) {
    const lonDiff = maxLon - minLon
    if (lonDiff > 0) {
      zoomX = Math.log2((width * 360) / (256 * lonDiff))
    }

    const latToMercatorY = (l: number) => {
      const rad = (l * Math.PI) / 180
      return Math.log(Math.tan(Math.PI / 4 + rad / 2))
    }
    const yDiff = Math.abs(latToMercatorY(maxLat) - latToMercatorY(minLat))
    if (yDiff > 0) {
      zoomY = Math.log2((height * 2 * Math.PI) / (256 * yDiff))
    }

    const rawZoom = Math.min(zoomX, zoomY, MAX_ZOOM)
    return Math.max(Math.floor(rawZoom) - 1, MIN_ZOOM)
  }
  return MAX_ZOOM
}

/** Разбирает сообщение центрирования карты в координаты и зум. */
export const parseCenterMapMessage = (
  message: Record<string, unknown>,
  windowWidth?: number,
  windowHeight?: number,
): CenterMapParams | null => {
  const lat = Number(message.latitude)
  const lon = Number(message.longitude)
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return null
  }

  let zoom = typeof message.zoom === 'number' ? message.zoom : MAX_ZOOM

  if (Array.isArray(message.bbox) && message.bbox.length === 4) {
    zoom = calculateZoomFromBbox(message.bbox as number[], windowWidth, windowHeight)
  }

  return { latitude: lat, longitude: lon, zoom }
}

/**
 * Ищет дату трекера в кнопках интерфейса и уведомляет слушателей при
 * изменении. Возвращает последнюю увиденную дату.
 */
export const checkAndNotifyTrackerDate = ({
  lastDate,
  onDateChange,
}: {
  lastDate: string
  onDateChange: (newDate: string) => void
}): string => {
  if (typeof document === 'undefined') return lastDate

  const btns = document.querySelectorAll('.nk-button__text')
  for (const btn of btns) {
    const txt = btn.textContent?.trim() || ''
    if (/\d{2}\.\d{2}\.\d{4}/.test(txt)) {
      if (txt !== lastDate) {
        onDateChange(txt)
        return txt
      }
      break
    }
  }
  return lastDate
}

/**
 * Выбирает дату трекера кликом по нативному выпадающему списку `nk-select`.
 *
 * Редактор не даёт API для выбора даты, поэтому повторяем жест пользователя.
 */
const setTrackerDateInDom = (
  nkDate: string,
  onComplete?: () => void,
): ReturnType<typeof setInterval> | null => {
  if (typeof document === 'undefined') return null

  const targetContainer = document.querySelector(
    '.nk-select.nk-select_theme_islands.nk-select_size_m',
  )
  if (!targetContainer) return null

  const button = targetContainer.querySelector(
    'button.nk-select__button',
  ) as HTMLButtonElement | null
  if (!button) return null

  const currentText = button.textContent || ''
  if (currentText.includes(nkDate)) return null

  button.dispatchEvent(
    new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      view: globalThis as unknown as Window,
    }),
  )
  button.dispatchEvent(
    new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      view: globalThis as unknown as Window,
    }),
  )
  button.click()

  let attempts = 0
  const checkInterval = setInterval(() => {
    attempts++
    const menuItems = document.querySelectorAll(
      '.nk-popup .nk-menu__item, [class*="popup_visible"] [class*="menu-item"]',
    )

    if (menuItems.length > 0) {
      clearInterval(checkInterval)

      let found = false
      for (const item of Array.from(menuItems)) {
        const itemText = item.textContent || ''
        if (itemText.includes(nkDate)) {
          ;(item as HTMLElement).click()
          found = true
          break
        }
      }

      if (!found) {
        button.click()
      }
      onComplete?.()
    } else if (attempts > 10) {
      clearInterval(checkInterval)
      onComplete?.()
    }
  }, 100)

  return checkInterval
}

type MapBridgeOptions = {
  /** Период опроса даты трекера: редактор не присылает событий о её смене. */
  trackerPollIntervalMs?: number
  /** Куда отдать новую дату (раньше — в iframe панели настроек). */
  onTrackerDateChange?: (date: string) => void
}

type MapBridge = {
  handleRuntimeMessage: (message: Record<string, unknown>) => void
  dispose: () => void
}

/**
 * Связывает background с картой: центрирование, дата трекера, выбор точки.
 *
 * Выбор точки (рисование в заметках и загрузке) отдаётся обратно в background:
 * ответ нужен панели, а она живёт в другом документе расширения.
 */
export const createMapBridge = ({
  trackerPollIntervalMs = 1000,
  onTrackerDateChange,
}: MapBridgeOptions = {}): MapBridge => {
  /** Кто запустил выбор координат: попап или блок создания в панели. */
  let activePickSource: string | undefined
  let lastTrackerDate = ''

  const handleCenterMap = (message: Record<string, unknown>): void => {
    const params = parseCenterMapMessage(message)
    if (params) {
      document.dispatchEvent(new CustomEvent('nmaps:centerMap', { detail: params }))
    } else {
      console.error('[yamapper map-bridge] Invalid coordinates for centerMap', message)
    }
  }

  const handlePointPicked = (event: Event): void => {
    const parsed = parsePointPickedEvent(event)
    if (!parsed) {
      return
    }
    const source = activePickSource
    activePickSource = undefined
    browser.runtime
      .sendMessage({
        action: POINT_PICKED_ACTION,
        coords: parsed.coords,
        geomType: parsed.geomType,
        source,
      })
      .catch((error: unknown) => {
        console.error('[yamapper map-bridge] pointPicked send failed:', error)
      })
  }

  const handleRuntimeMessage = (message: Record<string, unknown>): void => {
    switch (message?.action) {
      case START_POINT_PICKING_ACTION: {
        const geomType = typeof message.geomType === 'string' ? message.geomType : 'Point'
        activePickSource = typeof message.source === 'string' ? message.source : undefined
        notifyStartPickPoint(geomType)
        break
      }
      case CANCEL_POINT_PICKING_ACTION:
        activePickSource = undefined
        notifyCancelPickPoint()
        break
      case 'centerMap':
        handleCenterMap(message)
        break
      case 'SET_TRACKER_DATE':
        if (typeof message.date === 'string') {
          setTrackerDateInDom(message.date)
        }
        break
      default:
        break
    }
  }

  const pollTrackerDate = (): void => {
    lastTrackerDate = checkAndNotifyTrackerDate({
      lastDate: lastTrackerDate,
      onDateChange: (date) => {
        onTrackerDateChange?.(date)
      },
    })
  }

  document.addEventListener(NMAPS_POINT_PICKED_EVENT, handlePointPicked)
  const trackerInterval = setInterval(pollTrackerDate, trackerPollIntervalMs)
  pollTrackerDate()

  return {
    handleRuntimeMessage,
    dispose: () => {
      clearInterval(trackerInterval)
      document.removeEventListener(NMAPS_POINT_PICKED_EVENT, handlePointPicked)
    },
  }
}
