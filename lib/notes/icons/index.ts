import { YANDEX_DISK_FOLDER } from '@/lib/yandex/constants'

/**
 * Иконки заметок на Диске.
 *
 * Пользовательская иконка лежит рядом с геометрией, но отдельным файлом:
 * маленькая картинка не должна переписываться вместе с манифестом.
 */
export const NOTES_ICONS_FOLDER = `${YANDEX_DISK_FOLDER}/notes/icons`

/** Лимит файла: иконка показывается на карте размером 64×64. */
export const NOTES_ICON_MAX_BYTES = 64 * 1024

export const NOTES_ICON_ALLOWED_TYPES = ['image/png', 'image/svg+xml', 'image/webp'] as const

export const notesIconPath = (fileName: string): string => `${NOTES_ICONS_FOLDER}/${fileName}`

/**
 * Имя файла иконки: uuid и расширение.
 *
 * Проверяется отдельно от типа содержимого: имя приходит из панели и попадает
 * в путь на Диске, поэтому `../` и произвольные имена недопустимы.
 */
export const isAllowedIconFileName = (fileName: string): boolean =>
  /^[0-9a-f-]{36}\.(png|svg|webp)$/i.test(fileName)
