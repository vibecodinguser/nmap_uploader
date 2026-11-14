import { YANDEX_DISK_FOLDER } from '@/lib/yandex/constants'

/**
 * Пути заметок на Яндекс.Диске.
 *
 * Всё лежит рядом с Блокнотом картографа, но в отдельной папке `notes`:
 * заметки — самостоятельная сущность, а не часть нативных файлов.
 */
export const NOTES_FOLDER = `${YANDEX_DISK_FOLDER}/notes`
export const NOTES_MANIFEST_PATH = `${NOTES_FOLDER}/index.json`
export const NOTES_GEOMETRY_FOLDER = `${NOTES_FOLDER}/geometry`
export const NOTES_ICONS_FOLDER = `${NOTES_FOLDER}/icons`

export const notesManifestPath = (): string => NOTES_MANIFEST_PATH

export const notesShardPath = (shardId: string): string =>
  `${NOTES_GEOMETRY_FOLDER}/${shardId}.json`

export const notesIconPath = (fileName: string): string => `${NOTES_ICONS_FOLDER}/${fileName}`

/** Расширение файла иконки: хранится рядом с uuid, поэтому проверяется отдельно. */
export const isAllowedIconFileName = (fileName: string): boolean =>
  /^[0-9a-f-]{36}\.(png|svg|webp)$/i.test(fileName)
