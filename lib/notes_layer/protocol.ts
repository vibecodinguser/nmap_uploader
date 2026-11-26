import type { Note, NoteGeometry, NoteGroup } from '@/lib/notes/model/types'

/**
 * Договор между content script и MAIN-миром карты.
 *
 * Прямого доступа к ymaps у content script нет, поэтому снимок уходит
 * событием страницы, а обратно приходит выбор заметки. Всё, что здесь есть,
 * касается только формы этого обмена — ни карты, ни React.
 */

export const NMAPS_RENDER_NOTES_EVENT = 'yamapper-render-notes'
export const NMAPS_SELECT_NOTE_EVENT = 'yamapper-select-note'
export const NMAPS_NOTE_SELECTED_EVENT = 'yamapper-note-selected'

export type NotesLayerInput = {
  notes: Note[]
  geometries: Record<string, NoteGeometry>
  groups: NoteGroup[]
  hiddenIds: string[]
  /** Имя файла иконки → ссылка, по которой карта может её показать. */
  iconUrls: Record<string, string>
}

/** Отправить событие в MAIN-мир: `detail` уезжает строкой JSON. */
export const dispatchLayerEvent = (name: string, detail: unknown): void => {
  document.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }))
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
