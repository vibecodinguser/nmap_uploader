/**
 * Контракт загрузки заметки, созданной в сайдбаре.
 *
 * Отдельное действие вместо общего `uploadProcessedFiles`: страница карты
 * получает ровно одно право — сохранить заметку, а не загружать произвольные
 * файлы на Диск.
 */
import type { GeomType } from '@/lib/notes'

export const NOTES_SIDEBAR_UPLOAD_ACTION = 'uploadNoteFromSidebar' as const

export type SidebarNotePayload = {
  /** Координаты в порядке GeoJSON: [lon, lat]. */
  coords: number[][]
  geomType: GeomType
  name: string
  desc: string
  /** Дата блокнота в формате DD-MM-YYYY. */
  date: string
}

export const isSidebarNotePayload = (value: unknown): value is SidebarNotePayload => {
  if (!value || typeof value !== 'object') return false
  const note = value as Record<string, unknown>
  const geomTypes: GeomType[] = ['Point', 'LineString', 'Polygon']

  return (
    Array.isArray(note.coords) &&
    note.coords.length > 0 &&
    note.coords.every(
      (coord) =>
        Array.isArray(coord) &&
        coord.length === 2 &&
        typeof coord[0] === 'number' &&
        typeof coord[1] === 'number',
    ) &&
    typeof note.geomType === 'string' &&
    geomTypes.includes(note.geomType as GeomType) &&
    typeof note.name === 'string' &&
    note.name.trim().length > 0 &&
    typeof note.desc === 'string' &&
    typeof note.date === 'string'
  )
}
