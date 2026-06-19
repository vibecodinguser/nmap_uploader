import { ERR_SHAPEFILE, ProcessingError } from './errors';

/** Форматы бинарных данных после runtime.sendMessage. */
export type BinaryPayload = ArrayBuffer | number[] | Uint8Array | string | Record<string, number>;

const CHUNK_SIZE = 0x8000;

/** Кодирует файл для надёжной передачи через runtime.sendMessage. */
export const encodeBinaryPayload = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, offset + CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

const decodeBase64Payload = (payload: string): ArrayBuffer => {
  if (!payload) {
    throw new ProcessingError(ERR_SHAPEFILE, 'Пустой файл');
  }

  try {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes.buffer;
  } catch {
    throw new ProcessingError(ERR_SHAPEFILE, 'Некорректные бинарные данные файла (base64)');
  }
};

const isNumericString = (value: string): boolean => {
  return /^\d+$/.test(value);
};

const isNumericKeyObject = (value: unknown): value is Record<string, number> => {
  let result = false;
  if (value && 'object' === typeof value && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (Boolean(keys.length)) {
      result = keys.every(isNumericString);
    }
  }
  return result;
};

const fromNumericKeyObject = (value: Record<string, number>): ArrayBuffer => {
  const keys = Object.keys(value);
  const indices = keys.map(Number);
  const length = Math.max(...indices) + 1;
  const bytes = new Uint8Array(length);
  for (const index of indices) {
    const key = String(index);
    bytes[index] = Number(value[key]);
  }
  return bytes.buffer;
};

// --- Normalization Strategy ---

type Normalizer = (buffer: unknown) => ArrayBuffer | null;

const normalizeFromString: Normalizer = (buffer) => {
  let result: ArrayBuffer | null = null;
  if ('string' === typeof buffer) {
    result = decodeBase64Payload(buffer);
  }
  return result;
};

const normalizeFromArrayBuffer: Normalizer = (buffer) => {
  let result: ArrayBuffer | null = null;
  if (buffer instanceof ArrayBuffer) {
    result = buffer;
  }
  return result;
};

const normalizeFromUint8Array: Normalizer = (buffer) => {
  let result: ArrayBuffer | null = null;
  if (buffer instanceof Uint8Array) {
    const copy = new Uint8Array(buffer.byteLength);
    copy.set(buffer);
    result = copy.buffer;
  }
  return result;
};

const normalizeFromArray: Normalizer = (buffer) => {
  let result: ArrayBuffer | null = null;
  if (Array.isArray(buffer)) {
    result = new Uint8Array(buffer).buffer;
  }
  return result;
};

const normalizeFromNumericObject: Normalizer = (buffer) => {
  let result: ArrayBuffer | null = null;
  if (isNumericKeyObject(buffer)) {
    result = fromNumericKeyObject(buffer);
  }
  return result;
};

const normalizers: Normalizer[] = [
  normalizeFromString,
  normalizeFromArrayBuffer,
  normalizeFromUint8Array,
  normalizeFromArray,
  normalizeFromNumericObject,
];

/** Восстанавливает ArrayBuffer из payload. */
export const normalizeBinaryBuffer = (buffer: unknown): ArrayBuffer => {
  if (null == buffer) {
    throw new ProcessingError(ERR_SHAPEFILE, 'Пустой файл');
  }

  for (const normalize of normalizers) {
    const result = normalize(buffer);
    if (result) {
      return result;
    }
  }

  throw new ProcessingError(ERR_SHAPEFILE, 'Некорректные бинарные данные файла');
};
