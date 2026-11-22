/**
 * Мост между инструментом разреза и активностью редактора НЯК.
 *
 * Всё нужное редактор сам отдаёт представлению через `onViewAttrsRequest()`:
 * объект, элементы контура, карту, фабрики и обработчик изменения координат
 * элемента. Это единственная поверхность, на которую опирается инструмент:
 * внутренние модели и минифицированные методы не трогаем.
 *
 * Устройство редактора описано в `docs/nmaps-editor-internals.md`.
 */

import type { LineCoordinates } from './geometry'
import type { CutMapLike } from './mode'

type GeometryLike = {
  getType?: () => string
  getCoordinates?: () => unknown
  isClosed?: () => boolean
}

type GeoObjectLike = {
  getCategoryId?: () => string
  getGeometry?: () => GeometryLike | null
  getId?: () => string
  getSlavesByRole?: (role: string) => CollectionLike | null
}

type CollectionLike = {
  get?: () => GeoObjectLike[]
  getGeoObjects?: () => CollectionLike
  findById?: (id: string) => GeoObjectLike | null
  addGeoObject?: (geoObject: GeoObjectLike) => unknown
}

/**
 * Карта редактора — обёртка (`map-service`), а не `ymaps.Map`.
 *
 * У обёртки есть `getZoom`/`getCenter`/`getFlatBounds`, но нет ни `events`, ни
 * `options.get('projection')`: подписаться на клик и спроецировать координаты
 * можно только через настоящую карту из `getYMap()`.
 */
type MapWrapperLike = CutMapLike & {
  getYMap?: () => CutMapLike | null
}

type GeoObjectFactoryLike = {
  createGeoObject?: (params: Record<string, unknown>) => GeoObjectLike
}

type GeometryFactoryLike = {
  createPolyline?: (coordinates: LineCoordinates) => unknown
}

type ViewAttrsLike = {
  map?: CutMapLike | null
  geoObject?: GeoObjectLike | null
  elementRoleId?: string
  elementCategoryId?: string
  elements?: CollectionLike | null
  editableElements?: CollectionLike | null
  nonEditableElements?: CollectionLike | null
  geoObjectFactory?: GeoObjectFactoryLike | null
  geometryFactory?: GeometryFactoryLike | null
  onChangeElementCoords?: (element: unknown, coordinates: LineCoordinates) => unknown
}

type ActivityLike = {
  onViewAttrsRequest?: () => unknown
  params?: { geoObject?: GeoObjectLike | null; elementRoleId?: string; [key: string]: unknown }
}

/** Часть линии, которую инструмент умеет резать. */
export type CutElement = {
  id: string
  coordinates: LineCoordinates
  closed: boolean
}

/** Что инструменту нужно от открытого редактора. */
export type VegetationCutEditor = {
  /** Категория объекта, открытого в редакторе (`vegetation_fc`). */
  getCategoryId: () => string | null
  /** Категория элементов контура (`vegetation_el`). */
  getElementCategoryId: () => string | null
  /** Роль элементов в контуре. */
  getElementRoleId: () => string | null
  /** Части контура, доступные для правки. */
  getElements: () => CutElement[]
  getMap: () => CutMapLike | null
  /** Редактор умеет делить элемент: есть обработчик и фабрики. */
  canCut: () => boolean
  /** Заменяет элемент одной или двумя частями. */
  applyCut: (elementId: string, parts: LineCoordinates[]) => boolean
}

const isCoordinateArray = (value: unknown): value is LineCoordinates =>
  Array.isArray(value) &&
  value.length >= 2 &&
  value.every(
    (point) =>
      Array.isArray(point) &&
      point.length >= 2 &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1]),
  )

const readAttrs = (activity: ActivityLike): ViewAttrsLike | null => {
  try {
    const attrs = activity.onViewAttrsRequest?.()
    return attrs && typeof attrs === 'object' ? (attrs as ViewAttrsLike) : null
  } catch {
    return null
  }
}

/**
 * Объект редактора: представление отдаёт его в `attrs`, но у контейнерных
 * активностей (контур растительности) `attrs` содержит только тулбар, а объект
 * лежит в `params`. Без этого fallback категория не определяется.
 */
const readGeoObject = (
  activity: ActivityLike,
  attrs: ViewAttrsLike | null,
): GeoObjectLike | null => {
  const fromAttrs = attrs?.geoObject
  if (fromAttrs) return fromAttrs
  const fromParams = activity.params?.geoObject
  return fromParams && typeof fromParams === 'object' ? fromParams : null
}

const readElementRoleId = (activity: ActivityLike, attrs: ViewAttrsLike | null): string | null => {
  const fromAttrs = attrs?.elementRoleId
  if (typeof fromAttrs === 'string' && fromAttrs) return fromAttrs
  const fromParams = activity.params?.elementRoleId
  return typeof fromParams === 'string' && fromParams ? fromParams : null
}

/** Коллекция элементов: у редактора топологии это `elements`, у рисования — `editableElements`. */
const readElementsCollection = (attrs: ViewAttrsLike | null): CollectionLike | null => {
  const candidate = attrs?.elements ?? attrs?.editableElements ?? null
  if (!candidate || typeof candidate !== 'object') return null
  return candidate
}

const readElements = (collection: CollectionLike | null): GeoObjectLike[] => {
  if (!collection) return []
  try {
    if (typeof collection.get === 'function') {
      const items = collection.get()
      return Array.isArray(items) ? items : []
    }
    const nested = collection.getGeoObjects?.()
    if (nested && typeof nested.get === 'function') {
      const items = nested.get()
      return Array.isArray(items) ? items : []
    }
  } catch {
    // Коллекция могла быть изменена во время обхода
  }
  return []
}

const readElementCoordinates = (element: GeoObjectLike): LineCoordinates | null => {
  try {
    const coordinates = element.getGeometry?.()?.getCoordinates?.()
    return isCoordinateArray(coordinates) ? coordinates : null
  } catch {
    return null
  }
}

const isClosedCoordinates = (coordinates: LineCoordinates): boolean => {
  if (coordinates.length < 3) return false
  const first = coordinates[0]
  const last = coordinates[coordinates.length - 1]
  return Math.abs(first[0] - last[0]) < 1e-9 && Math.abs(first[1] - last[1]) < 1e-9
}

/**
 * Достаёт настоящую карту из того, что отдаёт редактор.
 *
 * `attrs.map` — обёртка `map-service`: у неё нет `events` и проекции, поэтому
 * клик по карте к ней не подписать. Настоящий `ymaps.Map` лежит внутри и
 * доступен через `getYMap()`.
 */
const readMap = (attrs: ViewAttrsLike | null): CutMapLike | null => {
  const candidate = attrs?.map as MapWrapperLike | null | undefined
  if (!candidate || typeof candidate !== 'object') return null

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

/** Собирает мост к активности редактора; `null`, если это не редактор. */
export const createEditorBridge = (activity: unknown): VegetationCutEditor | null => {
  if (!activity || typeof activity !== 'object') return null
  const candidate = activity as ActivityLike
  if (typeof candidate.onViewAttrsRequest !== 'function') return null

  return {
    getCategoryId: () => {
      try {
        const attrs = readAttrs(candidate)
        const categoryId = readGeoObject(candidate, attrs)?.getCategoryId?.()
        return typeof categoryId === 'string' && categoryId ? categoryId : null
      } catch {
        return null
      }
    },

    getElementCategoryId: () => {
      const categoryId = readAttrs(candidate)?.elementCategoryId
      return typeof categoryId === 'string' && categoryId ? categoryId : null
    },

    getElementRoleId: () => readElementRoleId(candidate, readAttrs(candidate)),

    getElements: () => {
      const result: CutElement[] = []
      for (const element of readElements(readElementsCollection(readAttrs(candidate)))) {
        const coordinates = readElementCoordinates(element)
        if (!coordinates) continue
        let id = ''
        try {
          id = String(element.getId?.() ?? '')
        } catch {
          id = ''
        }
        if (!id) continue
        result.push({ id, coordinates, closed: isClosedCoordinates(coordinates) })
      }
      return result
    },

    getMap: () => readMap(readAttrs(candidate)),

    canCut: () => {
      const attrs = readAttrs(candidate)
      if (!attrs) return false
      if (typeof attrs.onChangeElementCoords !== 'function') return false
      if (!attrs.geoObjectFactory || !attrs.geometryFactory) return false
      if (!readElementRoleId(candidate, attrs)) return false
      return readElements(readElementsCollection(attrs)).length > 0
    },

    applyCut: (elementId, parts) => {
      if (parts.length === 0 || parts.length > 2) return false

      const attrs = readAttrs(candidate)
      if (!attrs || typeof attrs.onChangeElementCoords !== 'function') return false

      const element = readElements(readElementsCollection(attrs)).find((item) => {
        try {
          return String(item.getId?.() ?? '') === elementId
        } catch {
          return false
        }
      })
      if (!element) return false

      try {
        attrs.onChangeElementCoords(element, parts[0])
      } catch {
        return false
      }

      if (parts.length === 1) return true

      return addElement(activity, candidate, attrs, parts[1])
    },
  }
}

/**
 * Добавляет вторую часть в контур.
 *
 * Создаём объект фабрикой редактора и кладём в коллекцию роли элементов —
 * так же, как это делает сам редактор при рисовании новой части. Команда
 * отмены при этом не создаётся: это ограничение зафиксировано в ADR 0012.
 */
const addElement = (
  activity: unknown,
  candidate: ActivityLike,
  attrs: ViewAttrsLike,
  coordinates: LineCoordinates,
): boolean => {
  const roleId = readElementRoleId(candidate, attrs)
  const categoryId = attrs.elementCategoryId
  const factory = attrs.geoObjectFactory
  const geometryFactory = attrs.geometryFactory
  const geoObject = readGeoObject(candidate, attrs)

  if (!roleId || !categoryId || !factory?.createGeoObject || !geometryFactory?.createPolyline) {
    return false
  }

  try {
    const collection = geoObject?.getSlavesByRole?.(roleId)
    if (!collection || typeof collection.addGeoObject !== 'function') return false

    const geometry = geometryFactory.createPolyline(coordinates)
    const element = factory.createGeoObject({ categoryId, geometry })
    collection.addGeoObject(element)
    return true
  } catch {
    return false
  }
}
