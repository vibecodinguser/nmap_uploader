import type { Parsed } from '../application/requests'
import { isAllowedIconFileName, NOTES_ICON_ALLOWED_TYPES, NOTES_ICON_MAX_BYTES } from '../icons'

/**
 * Запрос на загрузку иконки.
 *
 * Файл приходит в base64 внутри сообщения: иконка маленькая (≤64 КБ), а
 * отдельный канал передачи добавил бы ещё один способ ошибиться. Всё, что
 * проверяется, проверяется до обращения к Диску.
 */

type IconUploadRequest = { fileName: string; contentType: string; bytes: Uint8Array }

const decodeBase64 = (value: string): Uint8Array => {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

export const parseIconUploadRequest = (
  message: Record<string, unknown>,
): Parsed<IconUploadRequest> => {
  const { fileName, contentType, data } = message
  if (
    typeof fileName !== 'string' ||
    !isAllowedIconFileName(fileName) ||
    typeof contentType !== 'string' ||
    !(NOTES_ICON_ALLOWED_TYPES as readonly string[]).includes(contentType) ||
    typeof data !== 'string'
  ) {
    return { ok: false, error: 'INVALID_PAYLOAD' }
  }

  const bytes = decodeBase64(data)
  if (bytes.byteLength > NOTES_ICON_MAX_BYTES) return { ok: false, error: 'ICON_TOO_LARGE' }
  return { ok: true, value: { fileName, contentType, bytes } }
}
