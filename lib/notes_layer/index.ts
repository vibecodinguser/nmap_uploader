/**
 * Слой заметок на карте.
 *
 * Живёт в MAIN-мире рядом с ymaps: content script не имеет доступа к карте,
 * поэтому он присылает сюда уже разобранные данные событием, а слой сам решает,
 * как их нарисовать.
 */

import { findActiveMap, type YmapsMapLike } from '@/lib/nmaps/map_discovery'
import { centerMapOnLocation } from '@/lib/nmaps/repaint'
import {
  geometryAnchor,
  geometryBounds,
  type LonLat,
  type Note,
  type NoteGeometry,
  type NoteGroup,
  normalizeGeometry,
  zoomForBounds,
} from '@/lib/notes'
import type { NotesManifest } from '@/lib/notes/model/manifest'
import type { GeometryShard } from '@/lib/notes/model/shards'
import type { PolygonSnapTarget } from '@/lib/tracing/types'
import { LABEL_MIN_ZOOM, polygonRing, type RenderedNote, renderNotes } from './objects'

export const NMAPS_RENDER_NOTES_EVENT = 'nmap-uploader-render-notes'
export const NMAPS_SELECT_NOTE_EVENT = 'nmap-uploader-select-note'
export const NMAPS_LOCATE_NOTE_EVENT = 'nmap-uploader-locate-note'
export const NMAPS_NOTE_SELECTED_EVENT = 'nmap-uploader-note-selected'

export type NotesLayerInput = {
  notes: Note[]
  geometries: Record<string, NoteGeometry>
  groups: NoteGroup[]
  hiddenIds: string[]
  /** Имя файла иконки → ссылка, по которой карта может её показать. */
  iconUrls: Record<string, string>
}

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

const dispatch = (name: string, detail: unknown): void => {
  document.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }))
}

/** Раскладывает снимок хранилища в то, что нужно слою. */
export const snapshotToLayerInput = ({
  manifest,
  shards,
  hiddenIds,
  iconUrls = {},
}: {
  manifest: NotesManifest
  shards: Record<string, GeometryShard>
  hiddenIds: string[]
  iconUrls?: Record<string, string>
}): NotesLayerInput => {
  const geometries: Record<string, NoteGeometry> = {}
  for (const shard of Object.values(shards)) {
    Object.assign(geometries, shard.notes)
  }

  return { notes: manifest.notes, geometries, groups: manifest.groups, hiddenIds, iconUrls }
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

  public getSelectedId(): string | null {
    return this.selectedId
  }

  /** Центрирует карту на заметке и подсвечивает её. */
  public locate(geometry: NoteGeometry): void {
    const anchor = geometryAnchor(geometry)
    if (!anchor) return

    const bounds = geometryBounds(geometry)
    const zoom = bounds ? Math.max(zoomForBounds(bounds), 15) : 17
    centerMapOnLocation({ latitude: anchor[1], longitude: anchor[0], zoom }, this.getMap)
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
    dispatch(NMAPS_NOTE_SELECTED_EVENT, { noteId: null })
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
        dispatch(NMAPS_NOTE_SELECTED_EVENT, { noteId })
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

export * from './objects'

/** Полигоны заметок, к которым разрешено притягивать нативную трассировку. */
export const collectPolygonTargets = (input: NotesLayerInput): PolygonSnapTarget[] => {
  const hidden = new Set(input.hiddenIds)
  const targets: PolygonSnapTarget[] = []

  for (const note of input.notes) {
    if (hidden.has(note.id)) continue
    const geometry = input.geometries[note.id]
    if (!geometry) continue

    const ring = polygonRing(geometry)
    if (ring && ring.length >= 4) {
      targets.push({ id: note.id, coordinates: ring })
    }
  }

  return targets
}

const parseDetail = (raw: unknown): unknown => {
  if (typeof raw !== 'string') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** Разбирает данные слоя из события страницы. */
export const parseLayerInput = (raw: unknown): NotesLayerInput | null => {
  const value = parseDetail(raw)
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>

  if (!Array.isArray(record.notes) || !record.geometries || !Array.isArray(record.groups)) {
    return null
  }

  return {
    notes: record.notes as NotesLayerInput['notes'],
    geometries: record.geometries as NotesLayerInput['geometries'],
    groups: record.groups as NotesLayerInput['groups'],
    hiddenIds: Array.isArray(record.hiddenIds)
      ? record.hiddenIds.filter((id): id is string => typeof id === 'string')
      : [],
    iconUrls:
      record.iconUrls && typeof record.iconUrls === 'object'
        ? (record.iconUrls as Record<string, string>)
        : {},
  }
}

/** Разбирает выбор заметки: `null` — выбор снят, `undefined` — событие битое. */
export const parseNoteSelection = (raw: unknown): string | null | undefined => {
  const value = parseDetail(raw)
  if (!value || typeof value !== 'object') return undefined
  const noteId = (value as { noteId?: unknown }).noteId
  if (noteId === null) return null
  return typeof noteId === 'string' ? noteId : undefined
}

/** Разбирает геометрию для центрирования карты. */
export const parseGeometryDetail = (raw: unknown): NoteGeometry | null =>
  normalizeGeometry(parseDetail(raw))
