import { findActiveMap, type YmapsMapLike } from '@/lib/nmaps/map_discovery'
import type { LonLat } from '@/lib/notes/model/types'
import { LABEL_MIN_ZOOM, type RenderedNote, renderNotes } from './objects'
import { dispatchLayerEvent, NMAPS_NOTE_SELECTED_EVENT, type NotesLayerInput } from './protocol'

/**
 * Адаптер ymaps: создание коллекции и объектов, события карты.
 *
 * Живёт в MAIN-мире. Всё, что можно проверить тестами, сюда не попадает:
 * сборка описаний объектов — в `objects.ts`, перевод снимка — в `convert.ts`,
 * разбор событий — в `protocol.ts`.
 */

type YmapsGeoObject = {
  properties?: { get?: (name: string) => unknown }
}

type YmapsCollection = {
  add: (object: unknown) => void
  remove: (object: unknown) => void
  removeAll: () => void
  events?: { add: (name: string, handler: (event: unknown) => void) => void }
}

type YmapsConstructor = new (...args: unknown[]) => unknown

type YmapsNamespace = {
  Placemark: YmapsConstructor
  Polyline: YmapsConstructor
  Polygon: YmapsConstructor
  GeoObjectCollection: new (
    properties?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => YmapsCollection
}

const getYmaps = (): YmapsNamespace | null => {
  const candidate = (globalThis as unknown as Record<string, unknown>).ymaps as
    | Partial<YmapsNamespace>
    | undefined
  if (!candidate?.Placemark || !candidate.Polyline || !candidate.Polygon) return null
  if (!candidate.GeoObjectCollection) return null
  return candidate as YmapsNamespace
}

/**
 * Рисует заметки поверх карты.
 *
 * Перерисовка инкрементальная: объект пересоздаётся только если изменился его
 * вид. Коллекция собирается один раз и дальше дополняется — иначе правка одной
 * заметки снимала бы с карты и заново ставила все остальные.
 */
export class NotesLayer {
  private collection: YmapsCollection | null = null
  private map: YmapsMapLike | null = null
  /** Поставленные на карту объекты по ключу «заметка:вид» и их отпечатки. */
  private objects = new Map<string, { object: unknown; signature: string }>()
  private input: NotesLayerInput = {
    notes: [],
    geometries: {},
    groups: [],
    hiddenIds: [],
    iconUrls: {},
  }
  private selectedId: string | null = null
  private labelsHidden = false
  private frame: number | null = null

  constructor(private readonly getMap: () => YmapsMapLike | null = findActiveMap) {}

  public render(input: NotesLayerInput): void {
    this.input = input
    this.apply()
  }

  public select(noteId: string | null): void {
    if (this.selectedId === noteId) return
    this.selectedId = noteId
    this.apply()
  }

  public destroy(): void {
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame)
      this.frame = null
    }
    this.collection?.removeAll()
    this.collection = null
    this.objects.clear()
    this.map?.events.remove('boundschange', this.handleBoundsChange)
    this.map?.events.remove('click', this.handleMapClick)
    this.map = null
  }

  private handleBoundsChange = (): void => {
    const map = this.map
    if (!map) return
    const zoom = map.getZoom()
    const shouldHide = zoom < LABEL_MIN_ZOOM
    if (shouldHide === this.labelsHidden) return

    this.labelsHidden = shouldHide
    this.scheduleApply()
  }

  private handleMapClick = (event: unknown): void => {
    const target = (event as { get?: (name: string) => unknown })?.get?.('target')
    if (target !== this.map) return
    if (this.selectedId === null) return
    this.selectedId = null
    this.apply()
    dispatchLayerEvent(NMAPS_NOTE_SELECTED_EVENT, { noteId: null })
  }

  private scheduleApply(): void {
    if (this.frame !== null) return
    this.frame = requestAnimationFrame(() => {
      this.frame = null
      this.apply()
    })
  }

  private ensureCollection(): { ymaps: YmapsNamespace; map: YmapsMapLike } | null {
    const ymaps = getYmaps()
    const map = this.getMap()
    if (!ymaps || !map) return null

    if (this.map !== map) {
      this.map?.events.remove('boundschange', this.handleBoundsChange)
      this.map?.events.remove('click', this.handleMapClick)
      // Прежняя коллекция принадлежала исчезнувшей карте: заводим новую и
      // забываем объекты, иначе они остались бы в старой коллекции.
      this.collection = null
      this.objects.clear()
      this.map = map
      map.events.add('boundschange', this.handleBoundsChange)
      map.events.add('click', this.handleMapClick)
    }

    if (!this.collection) {
      this.collection = new ymaps.GeoObjectCollection()
      ;(map as unknown as { geoObjects: { add: (object: unknown) => void } }).geoObjects.add(
        this.collection,
      )

      this.collection.events?.add('click', (event: unknown) => {
        const target = (event as { get?: (name: string) => unknown })?.get?.('target')
        const noteId = (target as YmapsGeoObject | undefined)?.properties?.get?.('noteId')
        if (typeof noteId !== 'string') return
        this.selectedId = noteId
        this.apply()
        dispatchLayerEvent(NMAPS_NOTE_SELECTED_EVENT, { noteId })
      })
    }

    return { ymaps, map }
  }

  private createObject(ymaps: YmapsNamespace, rendered: RenderedNote): unknown | null {
    const { coordinates, properties, options } = rendered
    const safeOptions = { ...options, hasBalloon: false, hasHint: true }

    if (rendered.kind === 'point' || rendered.kind === 'label') {
      return new ymaps.Placemark(coordinates as LonLat, properties, safeOptions)
    }
    if (rendered.kind === 'line') {
      return new ymaps.Polyline(coordinates as LonLat[], properties, safeOptions)
    }
    if (rendered.kind === 'polygon') {
      return new ymaps.Polygon(coordinates as LonLat[][], properties, safeOptions)
    }
    return null
  }

  /**
   * Отпечаток объекта: всё, что влияет на его вид.
   *
   * По нему видно, нужно ли пересоздавать объект: правка названия, цвета или
   * прозрачности одной заметки не должна снимать с карты остальные.
   */
  private static signatureOf(rendered: RenderedNote): string {
    return JSON.stringify([rendered.coordinates, rendered.properties, rendered.options])
  }

  /**
   * Перерисовка с переиспользованием неизменившихся объектов.
   *
   * Раньше коллекция очищалась целиком и собиралась заново. На карте это
   * выглядело мерцанием всех заметок при правке одной, а на тысяче объектов
   * ещё и стоило времени. Теперь пересоздаётся только то, у чего изменился
   * отпечаток; удалённые, скрытые и невидимые на текущем зуме подписи просто
   * убираются из коллекции.
   */
  private apply(): void {
    const context = this.ensureCollection()
    if (!context || !this.collection) return

    const { ymaps } = context
    const rendered = renderNotes({
      notes: this.input.notes,
      geometries: this.input.geometries,
      groups: this.input.groups,
      hiddenIds: this.input.hiddenIds,
      selectedId: this.selectedId,
      iconUrls: this.input.iconUrls,
    })

    const next = new Map<string, { object: unknown; signature: string }>()

    for (const item of rendered) {
      if (this.labelsHidden && item.kind === 'label') continue

      const key = `${item.id}:${item.kind}`
      const signature = NotesLayer.signatureOf(item)
      const existing = this.objects.get(key)

      if (existing && existing.signature === signature) {
        next.set(key, existing)
        continue
      }
      // Объект изменился: старый снимаем, новый ставим. Остальные не трогаем.
      if (existing) this.collection.remove(existing.object)

      const object = this.createObject(ymaps, item)
      if (!object) continue
      this.collection.add(object)
      next.set(key, { object, signature })
    }

    for (const [key, entry] of this.objects) {
      if (!next.has(key)) this.collection.remove(entry.object)
    }

    this.objects = next
  }
}
