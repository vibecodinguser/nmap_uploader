import { findActiveMap, type YmapsMapLike } from '@/lib/nmaps/map_discovery'
import { centerMapOnLocation } from '@/lib/nmaps/repaint'
import type { LonLat } from '@/lib/notes/model/types'
import { renderCluster } from './cluster_object'
import { clusterPoints } from './clustering'
import { selectVisibleLabels } from './label_layout'
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
  geometry?: { getCoordinates?: () => unknown }
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
  /** Округлённый зум последней перерисовки: по нему видно, надо ли пересчитать кластеры. */
  private zoomBucket: number | null = null
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

  /**
   * Зум изменился — пересчитать подписи и кластеры.
   *
   * Кластеры зависят от зума, поэтому перерисовка нужна не только на пороге
   * подписей. Шаг — целый зум: дробные значения приходят десятками за одну
   * прокрутку колеса, и пересчитывать кластеры на каждое было бы расточительно.
   */
  private handleBoundsChange = (): void => {
    const map = this.map
    if (!map) return

    const zoom = map.getZoom()
    const shouldHideLabels = zoom < LABEL_MIN_ZOOM
    const zoomBucket = Math.round(zoom)
    const labelsHiddenChanged = shouldHideLabels !== this.labelsHidden
    // Кластеры и подписи зависят от зума: на новом масштабе и расстояния на
    // экране другие, поэтому пересчитывать надо и то, и другое.
    const zoomChanged = zoomBucket !== this.zoomBucket

    if (!labelsHiddenChanged && !zoomChanged) return

    this.labelsHidden = shouldHideLabels
    this.zoomBucket = zoomBucket
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

  /** Приблизить карту к кластеру: следующий шаг зума показывает его заметки. */
  private zoomIntoCluster(target: YmapsGeoObject): void {
    const map = this.map
    if (!map) return
    const coordinates = target.geometry?.getCoordinates?.()
    if (!Array.isArray(coordinates) || coordinates.length !== 2) return

    const [lon, lat] = coordinates as [number, number]
    centerMapOnLocation(
      { latitude: lat, longitude: lon, zoom: Math.min(map.getZoom() + 2, 19) },
      this.getMap,
    )
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
        const properties = (target as YmapsGeoObject | undefined)?.properties

        // Клик по кластеру приближает карту: так из него видно отдельные
        // заметки. Выбирать тут нечего — за значком их несколько.
        const clusterNoteIds = properties?.get?.('clusterNoteIds')
        if (typeof clusterNoteIds === 'string') {
          this.zoomIntoCluster(target as YmapsGeoObject)
          return
        }

        const noteId = properties?.get?.('noteId')
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

    if (rendered.kind === 'point' || rendered.kind === 'label' || rendered.kind === 'icon') {
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
  /**
   * Заменяет близкие точки значком кластера.
   *
   * Кластеризуются только точки: у линии и полигона важен сам контур, и
   * прятать его в значок с числом было бы бессмысленно. Подписи и иконки
   * заметок, попавших в кластер, тоже снимаются — иначе они висели бы поверх
   * значка.
   */
  private withClusters(rendered: RenderedNote[], zoom: number): RenderedNote[] {
    const points = rendered.filter((item) => item.kind === 'point')
    if (points.length < 2) return rendered

    const clusters = clusterPoints({
      points: points.map((item) => ({
        id: item.id,
        coordinates: item.coordinates as [number, number],
      })),
      zoom,
    })

    const grouped = clusters.filter((cluster) => cluster.noteIds.length > 1)
    if (grouped.length === 0) return rendered

    const inCluster = new Set(grouped.flatMap((cluster) => cluster.noteIds))
    const rest = rendered.filter(
      (item) =>
        !(
          inCluster.has(item.id) &&
          (item.kind === 'point' || item.kind === 'label' || item.kind === 'icon')
        ),
    )

    return [...rest, ...grouped.map(renderCluster)]
  }

  /**
   * Убирает подписи, которые наезжают друг на друга.
   *
   * Подпись — HTML-строка под объектом; на плотном наборе они складываются в
   * нечитаемую кашу. Показывается подпись выбранной заметки, затем остальные в
   * стабильном порядке: так при перерисовке подписи не прыгают местами.
   */
  private withVisibleLabels(rendered: RenderedNote[], zoom: number): RenderedNote[] {
    const labels = rendered.filter((item) => item.kind === 'label')
    if (labels.length < 2) return rendered

    const visible = selectVisibleLabels({
      labels: labels.map((item) => ({
        id: item.id,
        coordinates: item.coordinates as [number, number],
        text: String(item.properties.iconContent ?? ''),
      })),
      zoom,
      priority: this.selectedId ? [this.selectedId] : [],
    })

    const keep = new Set(visible.map((label) => label.id))
    return rendered.filter((item) => item.kind !== 'label' || keep.has(item.id))
  }

  private apply(): void {
    const context = this.ensureCollection()
    if (!context || !this.collection) return

    const { ymaps } = context
    const zoom = this.map?.getZoom() ?? 16
    this.zoomBucket = Math.round(zoom)

    const rendered = this.withVisibleLabels(
      this.withClusters(
        renderNotes({
          notes: this.input.notes,
          geometries: this.input.geometries,
          groups: this.input.groups,
          hiddenIds: this.input.hiddenIds,
          selectedId: this.selectedId,
          iconUrls: this.input.iconUrls,
        }),
        zoom,
      ),
      zoom,
    )

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
