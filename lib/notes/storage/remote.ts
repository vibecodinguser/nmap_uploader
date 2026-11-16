import { ERR_NETWORK, ProcessingError } from '@/lib/errors'
import { downloadDiskFile, downloadDiskText, uploadDiskFile } from '@/lib/yandex/disk_files'
import { notesIconPath } from '../icons'
import { type NotesManifest, parseManifest } from '../model/manifest'
import { type GeometryShard, parseShard } from '../model/shards'
import { notesManifestPath, notesShardPath } from './paths'

/** Порт удалённого хранилища заметок: чтение и запись файлов на Диске. */
export type NotesRemote = {
  readManifest: () => Promise<NotesManifest | null>
  writeManifest: (manifest: NotesManifest) => Promise<void>
  readShard: (shardId: string) => Promise<GeometryShard | null>
  writeShard: (shardId: string, shard: GeometryShard) => Promise<void>
  readIcon: (fileName: string) => Promise<Uint8Array | null>
  writeIcon: (fileName: string, bytes: Uint8Array, contentType: string) => Promise<void>
}

export const NOTES_MANIFEST_CORRUPT = 'NOTES_MANIFEST_CORRUPT'
export const NOTES_SHARD_CORRUPT = 'NOTES_SHARD_CORRUPT'

const parseJson = (text: string, label: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    throw new ProcessingError(ERR_NETWORK, `${label} повреждён и не читается как JSON`)
  }
}

/**
 * Адаптер Яндекс.Диска.
 *
 * Битый манифест — ошибка, а не «пустой список»: если вернуть пустоту, первое
 * же сохранение затрёт пользователю все заметки.
 */
export const createDiskNotesRemote = ({ token }: { token: string }): NotesRemote => ({
  readManifest: async () => {
    const text = await downloadDiskText({ logicalPath: notesManifestPath(), token })
    if (text === null) return null
    return parseManifest(parseJson(text, 'Манифест заметок'))
  },

  writeManifest: async (manifest) => {
    await uploadDiskFile({
      logicalPath: notesManifestPath(),
      token,
      body: JSON.stringify(manifest, null, 2),
      contentType: 'application/json',
    })
  },

  readShard: async (shardId) => {
    const text = await downloadDiskText({ logicalPath: notesShardPath(shardId), token })
    if (text === null) return null
    const parsed = parseShard(parseJson(text, `Шард геометрии ${shardId}`))
    if (!parsed) {
      throw new ProcessingError(
        NOTES_SHARD_CORRUPT,
        `Шард геометрии ${shardId} имеет неизвестную структуру`,
      )
    }
    return parsed
  },

  writeShard: async (shardId, shard) => {
    await uploadDiskFile({
      logicalPath: notesShardPath(shardId),
      token,
      body: JSON.stringify(shard, null, 2),
      contentType: 'application/json',
    })
  },

  readIcon: async (fileName) => downloadDiskFile({ logicalPath: notesIconPath(fileName), token }),

  writeIcon: async (fileName, bytes, contentType) => {
    await uploadDiskFile({
      logicalPath: notesIconPath(fileName),
      token,
      body: bytes,
      contentType,
    })
  },
})
