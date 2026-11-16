import type { NotesManifest } from './manifest'
import type { GeometryShard } from './shards'
import type { Note, NoteGeometry, NoteGroup } from './types'

/**
 * Контракт заметок между панелью, background, картой и слоем.
 *
 * Панель — отдельная страница расширения в iframe, карта — content script.
 * Напрямую они не общаются: всё идёт через background, который один знает и
 * хранилище, и открытые вкладки карты. Снимок состояния здесь один на всех —
 * раньше у панели, background и слоя были три несовместимых типа.
 */

/**
 * Состояние заметок в хранилище: манифест и геометрия.
 *
 * Отдельный тип от `NotesSnapshot`, потому что локальное скрытие (`hiddenIds`)
 * на Диске не лежит: это режим просмотра «у меня сейчас».
 */
export type NotesData = {
  manifest: NotesManifest
  /** Шарды геометрии по ключу `YYYY-MM`. */
  shards: Record<string, GeometryShard>
}

/**
 * Снимок состояния заметок.
 *
 * Составной, а не «манифест + шарды по требованию»: слою карты нужны все
 * геометрии сразу, а панели — манифест целиком для поиска и группировки.
 */
export type NotesSnapshot = NotesData & {
  /** Скрытые у меня заметки: локальное состояние, не свойство заметки. */
  hiddenIds: string[]
}

/**
 * Изменение состояния одним ответом на мутацию.
 *
 * `shards` содержит только затронутые шарды, `manifest` — манифест целиком:
 * получатель накладывает патч на свой снимок, не перечитывая Диск.
 */
export type NotesPatch = NotesData

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
/** Панель просит начать рисование фигуры на карте. */
export const NOTES_START_DRAW_ACTION = 'NOTES_START_DRAW'
/** Карта сообщает, что фигура нарисована. */
export const NOTES_DRAW_FINISHED_ACTION = 'NOTES_DRAW_FINISHED'
/** Скрытие заметок: локальное состояние, но карте нужно перерисоваться. */
export const NOTES_HIDDEN_CHANGED_ACTION = 'NOTES_HIDDEN_CHANGED'

export type NotesLoadRequest = { action: typeof NOTES_LOAD_ACTION }

export type NotesLoadResponse = { ok: true; snapshot: NotesSnapshot } | { ok: false; error: string }

export type NotesMutationResponse = { ok: true; patch: NotesPatch } | { ok: false; error: string }

export type NotesSaveNoteRequest = {
  action: typeof NOTES_SAVE_NOTE_ACTION
  note: Note
  geometry: NoteGeometry
}

export type NotesDeleteNoteRequest = {
  action: typeof NOTES_DELETE_NOTE_ACTION
  noteId: string
  /** Дата заметки: по ней сразу известен шард геометрии. */
  date?: string
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

/** background → панель: широковещательный снимок после изменения. */
export type NotesSnapshotMessage = {
  action: typeof NOTES_SNAPSHOT_ACTION
  snapshot: NotesSnapshot
}

/** background → карта: перерисовать слой заметок. */
export type NotesRenderMessage = {
  action: typeof NOTES_RENDER_ACTION
  snapshot: NotesSnapshot
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

/** Виды, которые пользователь рисует на карте. */
export const DRAWABLE_NOTE_KINDS = ['Point', 'Line', 'Polygon', 'Square', 'Circle'] as const

export type DrawableNoteKind = (typeof DRAWABLE_NOTE_KINDS)[number]

export const isDrawableNoteKind = (value: unknown): value is DrawableNoteKind =>
  typeof value === 'string' && (DRAWABLE_NOTE_KINDS as readonly string[]).includes(value)

export type NotesStartDrawRequest = {
  action: typeof NOTES_START_DRAW_ACTION
  kind: DrawableNoteKind
}

export type NotesDrawFinishedMessage = {
  action: typeof NOTES_DRAW_FINISHED_ACTION
  kind: DrawableNoteKind
  /**
   * Координаты в порядке GeoJSON: [lon, lat].
   *
   * Точка — одна координата, линия и многоугольник — все вершины, квадрат и
   * круг — две точки: у квадрата это противоположные углы, у круга — центр и
   * точка на окружности.
   */
  coords: [number, number][]
}

export type NotesHiddenChangedRequest = {
  action: typeof NOTES_HIDDEN_CHANGED_ACTION
  hiddenIds: string[]
}
