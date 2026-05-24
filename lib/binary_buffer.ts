import { ERR_SHAPEFILE, ProcessingError } from './errors'

/** Форматы бинарных данных после runtime.sendMessage. */
export type BinaryPayload = ArrayBuffer | number[] | Uint8Array | string | Record<string, number>

const CHUNK_SIZE = 0x8000

/** Кодирует файл для надёжной передачи через runtime.sendMessage. */
export const encodeBinaryPayload = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK_SIZE))
  }
  return btoa(binary)
}

const decodeBase64Payload = (payload: string): ArrayBuffer => {
  if (!payload) {
    throw new ProcessingError(ERR_SHAPEFILE, 'Пустой файл')
  }

  try {
    const binary = atob(payload)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }
    return bytes.buffer
  } catch {
    throw new ProcessingError(ERR_SHAPEFILE, 'Некорректные бинарные данные файла (base64)')
  }
}

const isNumericKeyObject = (value: unknown): value is Record<string, number> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const keys = Object.keys(value)
  if (keys.length === 0) return false
  return keys.every((key) => /^\d+$/.test(key))
}

const fromNumericKeyObject = (value: Record<string, number>): ArrayBuffer => {
  const indices = Object.keys(value).map(Number)
  const length = Math.max(...indices) + 1
  const bytes = new Uint8Array(length)
  for (const index of indices) {
    bytes[index] = Number(value[String(index)])
  }
  return bytes.buffer
}

/** Восстанавливает ArrayBuffer из payload. */
export const normalizeBinaryBuffer = (buffer: unknown): ArrayBuffer => {
  if (buffer == null) {
    throw new ProcessingError(ERR_SHAPEFILE, 'Пустой файл')
  }

  if (typeof buffer === 'string') return decodeBase64Payload(buffer)

  if (buffer instanceof ArrayBuffer) return buffer

  if (buffer instanceof Uint8Array) {
    const copy = new Uint8Array(buffer.byteLength)
    copy.set(buffer)
    return copy.buffer
  }

  if (Array.isArray(buffer)) {
    return new Uint8Array(buffer).buffer
  }

  if (isNumericKeyObject(buffer)) {
    return fromNumericKeyObject(buffer)
  }

  throw new ProcessingError(ERR_SHAPEFILE, 'Некорректные бинарные данные файла')
}
