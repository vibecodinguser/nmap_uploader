/**
 * Мост между инструментом разреза и активностью редактора НЯК.
 *
 * Всё нужное редактор сам отдаёт представлению через `onViewAttrsRequest()`:
 * объект, элементы контура, карту, фабрики и обработчик изменения координат
 * элемента. Сверх этого инструмент берёт у активности только менеджер команд,
 * и находит его по набору методов, а не по минифицированному имени поля.
 *
 * Устройство редактора описано в `docs/nmaps-editor-internals.md`.
 */

import type { LineCoordinates } from './geometry'
import { type CutMapLike, unwrapYMap } from './mode'
import { type CutTarget, resolveCutTarget } from './targets'

type GeometryLike = {
  getType?: () => string
  getCoordinates?: () => unknown
  isClosed?: () => boolean
}

type GeoObjectLike = {
  getCategoryId?: () => string
  getGeometry?: () => GeometryLike | null
  getId?: () => string
  getSlavesByRole?: (role: string) => RelationLike | null
}

/** Коллекция объектов: её рисует представление редактора. */
type CollectionLike = {
  get?: () => GeoObjectLike[]
  getGeoObjects?: () => CollectionLike
  findById?: (id: string) => GeoObjectLike | null
  add?: (geoObject: GeoObjectLike) => unknown
  remove?: (geoObject: GeoObjectLike) => unknown
}

/** Связь «контур → части»: по ней сервер узнаёт о новых и убранных частях. */
type RelationLike = {
  addGeoObject?: (geoObject: GeoObjectLike) => unknown
  removeGeoObject?: (geoObject: GeoObjectLike) => unknown
}

/** Команда редактора: то, что кладётся в историю отмены. */
type CommandLike = {
  apply: () => unknown
  undo: () => unknown
  redo?: () => unknown
}

/** Менеджер команд активности: через него идёт любая правка и её отмена. */
type CommandManagerLike = {
  apply: (command: CommandLike) => unknown
  undo: () => unknown
  redo: () => unknown
  canUndo: () => boolean
  canRedo: () => boolean
}

type GeometryRestrictionsLike = {
  stopWatching?: (geometry: unknown) => unknown
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
  geometryRestrictionsManager?: GeometryRestrictionsLike | null
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
}

/** Что инструменту нужно от открытого редактора. */
export type CutEditor = {
  /** Цель разреза: растительность или водоём. */
  getTarget: () => CutTarget | null
  /** Категория объекта, открытого в редакторе (`vegetation_fc`). */
  getCategoryId: () => string | null
  /** Категория элементов контура (`vegetation_el`). */
  getElementCategoryId: () => string | null
  /** Роль элементов в контуре. */
  getElementRoleId: () => string | null
  /** Части контура, доступные для правки. */
  getElements: () => CutElement[]
  getMap: () => CutMapLike | null
  /** Редактор отдаёт части контура, обработчик правки и фабрики. */
  canEditElements: () => boolean
  /** У активности нашёлся менеджер команд — без него разрез не отменить. */
  hasCommandManager: () => boolean
  /** Разрез доступен: есть и что править, и чем отменять. */
  canCut: () => boolean
  /**
   * Заменяет элемент одной или двумя частями.
   *
   * Разрез ложится в историю редактора одной командой: `Ctrl+Z` возвращает
   * линию целиком, `Ctrl+Y` режет снова.
   */
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
 * активностей (контур объекта) `attrs` содержит только тулбар, а объект
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

/** Достаёт настоящую карту из того, что отдаёт редактор. */
const readMap = (attrs: ViewAttrsLike | null): CutMapLike | null => unwrapYMap(attrs?.map)

/** Собирает мост к активности редактора; `null`, если это не редактор. */
export const createEditorBridge = (activity: unknown): CutEditor | null => {
  if (!activity || typeof activity !== 'object') return null
  const candidate = activity as ActivityLike
  if (typeof candidate.onViewAttrsRequest !== 'function') return null

  return {
    getTarget: () => {
      const attrs = readAttrs(candidate)
      return (
        resolveCutTarget(readGeoObject(candidate, attrs)?.getCategoryId?.() ?? null) ??
        resolveCutTarget(attrs?.elementCategoryId ?? null)
      )
    },

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
        result.push({ id, coordinates })
      }
      return result
    },

    getMap: () => readMap(readAttrs(candidate)),

    canEditElements: () => canEditElements(candidate, readAttrs(candidate)),

    hasCommandManager: () => findCommandManager(candidate) !== null,

    canCut: () =>
      canEditElements(candidate, readAttrs(candidate)) && findCommandManager(candidate) !== null,

    applyCut: (elementId, parts) => {
      if (parts.length === 0 || parts.length > 2) return false

      const attrs = readAttrs(candidate)
      const onChange = attrs?.onChangeElementCoords
      if (!attrs || typeof onChange !== 'function') return false

      const commands = findCommandManager(candidate)
      if (!commands) return false

      const element = readElements(readElementsCollection(attrs)).find((item) => {
        try {
          return String(item.getId?.() ?? '') === elementId
        } catch {
          return false
        }
      })
      if (!element) return false

      // Вторая часть готовится до любой правки: если её создать нельзя,
      // линия должна остаться нетронутой.
      const addition = parts.length === 2 ? prepareAddition(candidate, attrs, parts[1]) : null
      if (parts.length === 2 && !addition) return false

      const edit = captureCommand(commands, () => onChange(element, parts[0]))
      if (!edit) return false

      try {
        commands.apply({
          apply: () => {
            edit.apply()
            addition?.add()
          },
          undo: () => {
            addition?.remove()
            edit.undo()
          },
          redo: () => {
            if (typeof edit.redo === 'function') edit.redo()
            else edit.apply()
            addition?.add()
          },
        })
      } catch {
        return false
      }

      return true
    },
  }
}

const canEditElements = (candidate: ActivityLike, attrs: ViewAttrsLike | null): boolean => {
  if (!attrs) return false
  if (typeof attrs.onChangeElementCoords !== 'function') return false
  if (!attrs.geoObjectFactory || !attrs.geometryFactory) return false
  if (!readElementRoleId(candidate, attrs)) return false
  return readElements(readElementsCollection(attrs)).length > 0
}

const isCommandManager = (value: unknown): value is CommandManagerLike => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.apply === 'function' &&
    typeof candidate.undo === 'function' &&
    typeof candidate.redo === 'function' &&
    typeof candidate.canUndo === 'function' &&
    typeof candidate.canRedo === 'function'
  )
}

const isCommand = (value: unknown): value is CommandLike => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.apply === 'function' && typeof candidate.undo === 'function'
}

/**
 * Находит менеджер команд активности.
 *
 * В `attrs` редактор его не отдаёт, а имя поля в бандле минифицировано и
 * меняется от сборки к сборке. Набор методов (`apply`, `undo`, `redo`,
 * `canUndo`, `canRedo`) при этом стабилен, поэтому ищем по нему. Если
 * подходящих полей нет или их несколько, инструмент не включается: угадывать,
 * в чью историю писать, нельзя.
 */
const findCommandManager = (activity: ActivityLike): CommandManagerLike | null => {
  let values: unknown[]
  try {
    values = Object.values(activity)
  } catch {
    return null
  }

  const found = new Set<CommandManagerLike>()
  for (const value of values) {
    if (isCommandManager(value)) found.add(value)
  }
  if (found.size !== 1) return null

  const [manager] = found
  return manager
}

/**
 * Забирает команду, которую редактор собирался применить, не применяя её.
 *
 * `onChangeElementCoords` сам кладёт правку в историю. Чтобы разрез был одной
 * записью, на время вызова подменяем `apply` менеджера: редактор собирает свою
 * команду как обычно (правка координат и фиксация элемента в контуре), а мы
 * включаем её в общую команду разреза.
 */
const captureCommand = (commands: CommandManagerLike, run: () => unknown): CommandLike | null => {
  const captured: unknown[] = []
  const target = commands as unknown as Record<string, unknown>
  const hadOwnApply = Object.hasOwn(target, 'apply')
  const ownApply = target.apply

  target.apply = (command: unknown) => {
    captured.push(command)
  }
  try {
    run()
  } catch {
    return null
  } finally {
    if (hadOwnApply) target.apply = ownApply
    else Reflect.deleteProperty(target, 'apply')
  }

  // Ноль команд — редактор отказал в правке (например, лимит вершин);
  // больше одной — порядок их применения нам неизвестен.
  const [command] = captured
  return captured.length === 1 && isCommand(command) ? command : null
}

type ElementAddition = {
  add: () => void
  remove: () => void
}

/**
 * Готовит вторую часть линии и способ добавить её в контур и убрать обратно.
 *
 * Новая часть должна попасть в два места: в коллекцию `elements`, которую
 * рисует редактор (иначе её не видно и нельзя резать дальше), и в связь
 * контура с частями (иначе она не сохранится).
 */
const prepareAddition = (
  candidate: ActivityLike,
  attrs: ViewAttrsLike,
  coordinates: LineCoordinates,
): ElementAddition | null => {
  const roleId = readElementRoleId(candidate, attrs)
  const categoryId = attrs.elementCategoryId
  const factory = attrs.geoObjectFactory
  const geometryFactory = attrs.geometryFactory
  const drawn = readElementsCollection(attrs)

  if (!roleId || !categoryId || !factory?.createGeoObject || !geometryFactory?.createPolyline) {
    return null
  }
  if (typeof drawn?.add !== 'function' || typeof drawn.remove !== 'function') return null

  try {
    const relation = readGeoObject(candidate, attrs)?.getSlavesByRole?.(roleId)
    if (
      typeof relation?.addGeoObject !== 'function' ||
      typeof relation.removeGeoObject !== 'function'
    ) {
      return null
    }

    const geometry = geometryFactory.createPolyline(coordinates)
    const element = factory.createGeoObject({ categoryId, geometry })

    // Порядок шагов повторяет штатное рисование новой части контура в НЯК:
    // сначала связь, потом коллекция — к перерисовке контур уже согласован.
    return {
      add: () => {
        relation.addGeoObject?.(element)
        drawn.add?.(element)
      },
      remove: () => {
        // Редактор начинает следить за геометрией при добавлении в коллекцию,
        // но при удалении сам слежку не снимает.
        try {
          attrs.geometryRestrictionsManager?.stopWatching?.(element.getGeometry?.())
        } catch {
          // Слежка — вспомогательная: её сбой не должен срывать отмену
        }
        relation.removeGeoObject?.(element)
        drawn.remove?.(element)
      },
    }
  } catch {
    return null
  }
}
