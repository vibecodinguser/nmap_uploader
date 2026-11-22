/**
 * Маркеры разрезов на карте.
 *
 * Редактор НЯК показывает нативную точку разреза красной «каплей» с ножницами
 * (пресет `nk#splitRedPinIcon`). У контурных частей таких точек нет, поэтому
 * маркеры ставим сами — тем же пресетом, чтобы вид совпадал с нативным.
 *
 * Маркеры живут только пока включён режим и только на карте: в историю
 * редактора они не попадают и на сервер не уходят.
 */

import type { LineCoordinates } from './geometry'
import type { CutMapLike } from './mode'

/** Нативный пресет редактора: красная капля с ножницами. */
export const SPLIT_PIN_PRESET = 'nk#splitRedPinIcon'

type PlacemarkLike = {
  events?: { add?: (name: string, handler: () => void) => unknown }
}

type GeoObjectsLike = {
  add?: (object: unknown) => unknown
  remove?: (object: unknown) => unknown
  clear?: () => unknown
}

type YmapsLike = {
  Placemark?: new (coordinates: number[], properties?: object, options?: object) => PlacemarkLike
}

/** Карта, на которую можно ставить маркеры. */
type PinMapLike = CutMapLike & {
  geoObjects?: GeoObjectsLike
  getYMap?: () => PinMapLike | null
}

const readYmaps = (): YmapsLike | null => {
  const candidate = (globalThis as Record<string, unknown>).ymaps
  return candidate && typeof candidate === 'object' ? (candidate as YmapsLike) : null
}

/** Достаёт карту с коллекцией объектов: у обёртки она внутри `getYMap()`. */
const readPinMap = (map: CutMapLike | null): PinMapLike | null => {
  const candidate = map as PinMapLike | null
  if (!candidate) return null

  if (typeof candidate.getYMap === 'function') {
    try {
      const inner = candidate.getYMap()
      if (inner && typeof inner === 'object') return inner
    } catch {
      // Обёртка могла быть уничтожена
    }
  }

  return candidate
}

export type CutPins = {
  /** Показывает маркеры в указанных точках, заменяя прежние. */
  show: (points: LineCoordinates) => void
  /** Убирает все маркеры. */
  clear: () => void
  /** Сколько маркеров сейчас на карте. */
  count: () => number
}

/**
 * Создаёт набор маркеров разрезов для карты.
 *
 * Если `ymaps` ещё не загружен или у карты нет коллекции объектов, набор
 * работает как пустышка: инструмент режет как обычно, просто без маркеров.
 */
export const createCutPins = (getMap: () => CutMapLike | null): CutPins => {
  let pins: PlacemarkLike[] = []
  let host: GeoObjectsLike | null = null

  const clear = (): void => {
    if (host) {
      for (const pin of pins) {
        try {
          host.remove?.(pin)
        } catch {
          // Карта могла быть уничтожена
        }
      }
    }
    pins = []
    host = null
  }

  const show = (points: LineCoordinates): void => {
    clear()
    if (points.length === 0) return

    const ymaps = readYmaps()
    const map = readPinMap(getMap())
    const collection = map?.geoObjects
    if (!ymaps?.Placemark || !collection?.add) return

    host = collection
    for (const point of points) {
      try {
        const pin = new ymaps.Placemark(point, {}, { preset: SPLIT_PIN_PRESET })
        collection.add(pin)
        pins.push(pin)
      } catch {
        // Один маркер не должен срывать остальные
      }
    }
  }

  return {
    show,
    clear,
    count: () => pins.length,
  }
}
