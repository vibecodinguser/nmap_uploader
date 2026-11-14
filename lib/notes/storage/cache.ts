import type { NotesManifest } from '../manifest'
import type { GeometryShard } from '../shards'

/**
 * Локальный кэш заметок в IndexedDB.
 *
 * Кэш — ускоритель, а не источник истины: он позволяет открыть панель до
 * ответа Диска и пережить отсутствие сети на чтение. Геометрия на 5 000
 * объектов в `storage.local` не помещается и не подходит по скорости записи.
 */
export type CachedIcon = { bytes: Uint8Array; contentType: string }

export type NotesCache = {
  readManifest: () => Promise<NotesManifest | null>
  writeManifest: (manifest: NotesManifest) => Promise<void>
  readShard: (shardId: string) => Promise<GeometryShard | null>
  writeShard: (shardId: string, shard: GeometryShard) => Promise<void>
  readIcon: (fileName: string) => Promise<CachedIcon | null>
  writeIcon: (fileName: string, icon: CachedIcon) => Promise<void>
  clear: () => Promise<void>
}

export const NOTES_CACHE_DB_NAME = 'nmap-notes'
export const NOTES_CACHE_DB_VERSION = 1

const MANIFEST_STORE = 'manifest'
const SHARDS_STORE = 'shards'
const ICONS_STORE = 'icons'
const MANIFEST_KEY = 'current'

const openDatabase = (): Promise<IDBDatabase | null> => {
  if (typeof globalThis.indexedDB === 'undefined') return Promise.resolve(null)

  return new Promise((resolve) => {
    const request = globalThis.indexedDB.open(NOTES_CACHE_DB_NAME, NOTES_CACHE_DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(MANIFEST_STORE)) db.createObjectStore(MANIFEST_STORE)
      if (!db.objectStoreNames.contains(SHARDS_STORE)) db.createObjectStore(SHARDS_STORE)
      if (!db.objectStoreNames.contains(ICONS_STORE)) db.createObjectStore(ICONS_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
  })
}

const runRequest = <T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> =>
  openDatabase().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null)
          return
        }
        try {
          const transaction = db.transaction(storeName, mode)
          const request = action(transaction.objectStore(storeName))
          request.onsuccess = () => resolve(request.result ?? null)
          request.onerror = () => resolve(null)
          transaction.oncomplete = () => db.close()
        } catch {
          db.close()
          resolve(null)
        }
      }),
  )

/**
 * Кэш, который ничего не хранит.
 *
 * Нужен там, где IndexedDB недоступна (тесты, среда без хранилища): вызывающий
 * код не должен обрастать проверками наличия кэша.
 */
export const createNoopNotesCache = (): NotesCache => ({
  readManifest: async () => null,
  writeManifest: async () => {},
  readShard: async () => null,
  writeShard: async () => {},
  readIcon: async () => null,
  writeIcon: async () => {},
  clear: async () => {},
})

export const createIndexedDbNotesCache = (): NotesCache => ({
  readManifest: async () =>
    (await runRequest<NotesManifest>(MANIFEST_STORE, 'readonly', (store) =>
      store.get(MANIFEST_KEY),
    )) ?? null,

  writeManifest: async (manifest) => {
    await runRequest(MANIFEST_STORE, 'readwrite', (store) => store.put(manifest, MANIFEST_KEY))
  },

  readShard: async (shardId) =>
    (await runRequest<GeometryShard>(SHARDS_STORE, 'readonly', (store) => store.get(shardId))) ??
    null,

  writeShard: async (shardId, shard) => {
    await runRequest(SHARDS_STORE, 'readwrite', (store) => store.put(shard, shardId))
  },

  readIcon: async (fileName) =>
    (await runRequest<CachedIcon>(ICONS_STORE, 'readonly', (store) => store.get(fileName))) ?? null,

  writeIcon: async (fileName, icon) => {
    await runRequest(ICONS_STORE, 'readwrite', (store) => store.put(icon, fileName))
  },

  clear: async () => {
    await Promise.all([
      runRequest(MANIFEST_STORE, 'readwrite', (store) => store.clear()),
      runRequest(SHARDS_STORE, 'readwrite', (store) => store.clear()),
      runRequest(ICONS_STORE, 'readwrite', (store) => store.clear()),
    ])
  },
})
