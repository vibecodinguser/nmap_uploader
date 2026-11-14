import type { NotesManifest } from './manifest'
import type { GeometryShard } from './shards'
import type { Note, NoteGeometry, NoteGroup } from './types'

/**
 * Контракт сообщений заметок.
 *
 * Панель — отдельная страница расширения в iframe, карта — content script.
 * Общаться напрямую они не могут, поэтому всё идёт через background: он один
 * знает и хранилище, и открытые вкладки карты.
 */
export const NOTES_LOAD_ACTION = 'NOTES_LOAD'
export const NOTES_SAVE_NOTE_ACTION = 'NOTES_SAVE_NOTE'
export const NOTES_DELETE_NOTE_ACTION = 'NOTES_DELETE_NOTE'
export const NOTES_SAVE_GROUP_ACTION = 'NOTES_SAVE_GROUP'
export const NOTES_DELETE_GROUP_ACTION = 'NOTES_DELETE_GROUP'
export const NOTES_MOVE_NOTE_ACTION = 'NOTES_MOVE_NOTE'
export const NOTES_UPLOAD_ICON_ACTION = 'NOTES_UPLOAD_ICON'
export const NOTES_SNAPSHOT_ACTION = 'NOTES_SNAPSHOT'
export const NOTES_RENDER_ACTION = 'NOTES_RENDER'
export const NOTES_VISIBILITY_ACTION = 'NOTES_VISIBILITY'
export const NOTES_SELECT_ACTION = 'NOTES_SELECT'

/** Снимок для отрисовки и для панели. */
export type NotesSnapshotPayload = {
  manifest: NotesManifest
  shards: Record<string, GeometryShard>
  hiddenIds: string[]
  /** Снимок собран из кэша: Диск ещё не ответил. */
  fromCache: boolean
}

export type NotesLoadRequest = { action: typeof NOTES_LOAD_ACTION }

export type NotesLoadResponse = {
  ok: boolean
  error?: string
  snapshot?: NotesSnapshotPayload
}

export type NotesSaveNoteRequest = {
  action: typeof NOTES_SAVE_NOTE_ACTION
  note: Note
  geometry: NoteGeometry
}

export type NotesMutationResponse = {
  ok: boolean
  error?: string
  manifest?: NotesManifest
  shards?: Record<string, GeometryShard>
}

export type NotesDeleteNoteRequest = {
  action: typeof NOTES_DELETE_NOTE_ACTION
  noteId: string
}

export type NotesSaveGroupRequest = {
  action: typeof NOTES_SAVE_GROUP_ACTION
  group: NoteGroup
}

export type NotesDeleteGroupRequest = {
  action: typeof NOTES_DELETE_GROUP_ACTION
  groupId: string
  mode: 'keepNotes' | 'cascade'
}

export type NotesMoveNoteRequest = {
  action: typeof NOTES_MOVE_NOTE_ACTION
  noteId: string
  groupId: string | null
}

export type NotesUploadIconRequest = {
  action: typeof NOTES_UPLOAD_ICON_ACTION
  fileName: string
  contentType: string
  /** Содержимое файла в base64 без префикса data URL. */
  data: string
}

export type NotesUploadIconResponse = { ok: boolean; error?: string; fileName?: string }

/** background → карта: перерисовать слой заметок. */
export type NotesRenderMessage = {
  action: typeof NOTES_RENDER_ACTION
  manifest: NotesManifest
  shards: Record<string, GeometryShard>
  hiddenIds: string[]
}

/** background → карта: переключились только скрытые. */
export type NotesVisibilityMessage = {
  action: typeof NOTES_VISIBILITY_ACTION
  hiddenIds: string[]
}

/** Выбор заметки: карта ↔ панель. */
export type NotesSelectMessage = {
  action: typeof NOTES_SELECT_ACTION
  noteId: string | null
}

export const NOTES_ICON_MAX_BYTES = 64 * 1024
export const NOTES_ICON_ALLOWED_TYPES = ['image/png', 'image/svg+xml', 'image/webp'] as const

/** Панель просит начать рисование фигуры на карте. */
export const NOTES_START_DRAW_ACTION = 'NOTES_START_DRAW'
/** Карта сообщает, что фигура нарисована. */
export const NOTES_DRAW_FINISHED_ACTION = 'NOTES_DRAW_FINISHED'
/** Скрытие заметок: локальное состояние, но карте нужно перерисоваться. */
export const NOTES_HIDDEN_CHANGED_ACTION = 'NOTES_HIDDEN_CHANGED'

export type NotesStartDrawRequest = {
  action: typeof NOTES_START_DRAW_ACTION
  kind: 'Point' | 'Line' | 'Polygon'
}

export type NotesDrawFinishedMessage = {
  action: typeof NOTES_DRAW_FINISHED_ACTION
  kind: 'Point' | 'Line' | 'Polygon'
  /** Координаты в порядке GeoJSON: [lon, lat]. */
  coords: [number, number][]
}

export type NotesHiddenChangedRequest = {
  action: typeof NOTES_HIDDEN_CHANGED_ACTION
  hiddenIds: string[]
}
