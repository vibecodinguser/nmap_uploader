import type { NotesManifest } from '../model/manifest'
import type { GeometryShard } from '../model/shards'
import type { NotesRemote } from './remote'

/**
 * Кэш чтений на время сеанса работы.
 *
 * Одна правка заметки — это чтение манифеста, чтение шарда, запись манифеста и
 * запись шарда. Пока пользователь правит свойства подряд, первые два запроса
 * каждый раз возвращают одно и то же, поэтому чтения кэшируются в памяти
 * background — единственного долгоживущего контекста расширения.
 *
 * Тонкость: кэшированное чтение используется и как база для слияния при
 * записи. Значит, изменения с другого устройства, сделанные внутри `ttlMs`,
 * локальная запись не увидит и перезапишет — окно «последний победил»
 * расширяется с одного запроса до TTL. Поэтому кэш принудительно сбрасывается
 * при явной загрузке снимка (`NOTES_LOAD`), при смене аккаунта и при любой
 * ошибке записи: после ошибки доверять прочитанному нельзя.
 */
export type CachingNotesRemote = NotesRemote & {
  /** Забыть всё прочитанное: следующий вызов пойдёт на Диск. */
  invalidate: () => void
}

export type CachingNotesRemoteOptions = {
  /** Сколько миллисекунд прочитанное считается свежим. */
  ttlMs?: number
  now?: () => number
}

/**
 * Сколько живёт прочитанное.
 *
 * Достаточно, чтобы серия правок (набор текста, протяжка ползунка) шла без
 * повторных чтений, и мало́, чтобы изменения с другого устройства появлялись
 * сами. Явная загрузка снимка сбрасывает кэш в любом случае.
 */
export const NOTES_READ_CACHE_TTL_MS = 10_000

type Entry<T> = { value: T; at: number }

export const createCachingNotesRemote = (
  remote: NotesRemote,
  { ttlMs = NOTES_READ_CACHE_TTL_MS, now = Date.now }: CachingNotesRemoteOptions = {},
): CachingNotesRemote => {
  let manifest: Entry<NotesManifest | null> | null = null
  const shards = new Map<string, Entry<GeometryShard | null>>()

  const isFresh = (entry: Entry<unknown>): boolean => now() - entry.at < ttlMs

  return {
    // Иконки не кэшируются: они читаются редко и по разу.
    readIcon: remote.readIcon,
    writeIcon: remote.writeIcon,

    readManifest: async () => {
      if (manifest && isFresh(manifest)) return manifest.value
      const value = await remote.readManifest()
      manifest = { value, at: now() }
      return value
    },

    writeManifest: async (next) => {
      await remote.writeManifest(next)
      // Запись — самое свежее знание о состоянии: кладём её в кэш, чтобы
      // следующая правка не перечитывала только что записанный файл.
      manifest = { value: next, at: now() }
    },

    readShard: async (shardId) => {
      const cached = shards.get(shardId)
      if (cached && isFresh(cached)) return cached.value
      const value = await remote.readShard(shardId)
      shards.set(shardId, { value, at: now() })
      return value
    },

    writeShard: async (shardId, shard) => {
      await remote.writeShard(shardId, shard)
      shards.set(shardId, { value: shard, at: now() })
    },

    invalidate: () => {
      manifest = null
      shards.clear()
    },
  }
}
