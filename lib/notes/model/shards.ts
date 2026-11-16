import { displayToIso } from '@/lib/date_format'
import { normalizeGeometry } from './manifest'
import type { NoteGeometry } from './types'

/**
 * Шард геометрии.
 *
 * Геометрия заметок разрезана по месяцам даты заметки: правка одной заметки
 * переписывает манифест и максимум один шард, а не всю геометрию. Имя шарда
 * выводится из даты, поэтому отдельный реестр ссылок не нужен.
 */
export const NOTES_SHARD_VERSION = 1

export type GeometryShard = {
  version: number
  updatedAt: string
  notes: Record<string, NoteGeometry>
}

export const createEmptyShard = (): GeometryShard => ({
  version: NOTES_SHARD_VERSION,
  updatedAt: new Date(0).toISOString(),
  notes: {},
})

/**
 * Ключ шарда для даты заметки (`YYYY-MM`) или `null`, если дата не читается.
 *
 * Даты до 1970 и после 2100 отбрасываются: это почти наверняка опечатка в
 * поле даты, а не реальная заметка.
 */
export const shardIdForDate = (displayDate: string): string | null => {
  const iso = displayToIso(displayDate)
  if (!iso) return null
  const year = Number.parseInt(iso.slice(0, 4), 10)
  if (year < 1970 || year > 2100) return null
  return iso.slice(0, 7)
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** Читает шард, отбрасывая по одной записи, которые не рисуются. */
export const parseShard = (raw: unknown): GeometryShard | null => {
  if (!isRecord(raw) || !isRecord(raw.notes)) return null

  const notes: Record<string, NoteGeometry> = {}
  for (const [id, value] of Object.entries(raw.notes)) {
    const geometry = normalizeGeometry(value)
    if (geometry) notes[id] = geometry
  }

  return {
    version: typeof raw.version === 'number' ? raw.version : NOTES_SHARD_VERSION,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(0).toISOString(),
    notes,
  }
}

export const setShardGeometry = (
  shard: GeometryShard,
  noteId: string,
  geometry: NoteGeometry,
): GeometryShard => ({
  version: NOTES_SHARD_VERSION,
  updatedAt: new Date().toISOString(),
  notes: { ...shard.notes, [noteId]: geometry },
})

export const removeShardGeometry = (shard: GeometryShard, noteId: string): GeometryShard => {
  if (!(noteId in shard.notes)) return shard
  const notes = { ...shard.notes }
  delete notes[noteId]
  return { version: NOTES_SHARD_VERSION, updatedAt: new Date().toISOString(), notes }
}
