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
 * Коллекция пересоздаётся при каждой перерисовке: объектов тысячи, но
 * перерисовка случается только на правку, а не на каждый кадр.
 */
export class NotesLayer {
  private collection: YmapsCollection | null = null
  private map: YmapsMapLike | null = null
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
      // Прежняя коллекция принадлежала исчезнувшей карте: заводим новую.
      this.collection = null
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

  private apply(): void {
    const context = this.ensureCollection()
    if (!context || !this.collection) return

    const { ymaps } = context
    this.collection.removeAll()

    const rendered = renderNotes({
      notes: this.input.notes,
      geometries: this.input.geometries,
      groups: this.input.groups,
      hiddenIds: this.input.hiddenIds,
      selectedId: this.selectedId,
      iconUrls: this.input.iconUrls,
    })

    for (const item of rendered) {
      if (this.labelsHidden && item.kind === 'label') continue
      const object = this.createObject(ymaps, item)
      if (object) this.collection.add(object)
    }
  }
}
