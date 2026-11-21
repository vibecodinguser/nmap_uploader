import { YANDEX_DISK_FOLDER } from '@/lib/yandex/constants'

/**
 * Пути заметок на Яндекс.Диске.
 *
 * Заметки живут в собственной папке приложения, а не внутри папки Блокнота
 * картографа. Причина: трекер редактора считает каждый подкаталог Блокнота
 * треком и читает его `index.json` как данные трека. Манифест заметок в этой
 * роли ломал отрисовку слоя трекера (`Object.keys(undefined)` в его бандле),
 * а сам трек можно было удалить прямо из настроек трекера.
 */
export const NOTES_ROOT_FOLDER = 'Приложения/Nmap Uploader'
export const NOTES_FOLDER = `${NOTES_ROOT_FOLDER}/notes`
export const NOTES_MANIFEST_PATH = `${NOTES_FOLDER}/index.json`
export const NOTES_GEOMETRY_FOLDER = `${NOTES_FOLDER}/geometry`
export const NOTES_ICONS_FOLDER = `${NOTES_FOLDER}/icons`

/**
 * Прежнее место заметок — внутри папки Блокнота.
 *
 * Оставлено для миграции и как запасной вариант: если перенос не удался,
 * сессия продолжает работать здесь, чтобы не показать пустой список поверх
 * целых данных. Трекер при этом продолжает видеть папку как трек `notes`.
 */
export const LEGACY_NOTES_FOLDER = `${YANDEX_DISK_FOLDER}/notes`
export const LEGACY_NOTES_MANIFEST_PATH = `${LEGACY_NOTES_FOLDER}/index.json`
export const LEGACY_NOTES_GEOMETRY_FOLDER = `${LEGACY_NOTES_FOLDER}/geometry`
export const LEGACY_NOTES_ICONS_FOLDER = `${LEGACY_NOTES_FOLDER}/icons`

export type NotesStorageLocation = 'current' | 'legacy'

let storageLocation: NotesStorageLocation = 'current'

/** Переключает сессию на прежнее место, если перенос не удался. */
export const setNotesStorageLocation = (location: NotesStorageLocation): void => {
  storageLocation = location
}

export const getNotesStorageLocation = (): NotesStorageLocation => storageLocation

const isLegacy = (): boolean => storageLocation === 'legacy'

export const notesManifestPath = (): string =>
  isLegacy() ? LEGACY_NOTES_MANIFEST_PATH : NOTES_MANIFEST_PATH

export const notesShardPath = (shardId: string): string =>
  `${isLegacy() ? LEGACY_NOTES_GEOMETRY_FOLDER : NOTES_GEOMETRY_FOLDER}/${shardId}.json`

export const notesIconsFolder = (): string =>
  isLegacy() ? LEGACY_NOTES_ICONS_FOLDER : NOTES_ICONS_FOLDER
