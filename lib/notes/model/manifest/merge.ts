import type { NoteTombstone } from '../types'
import { NOTES_MANIFEST_VERSION, type NotesManifest } from './schema'

const timestampOf = (value: string): number => {
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

const mergeById = <T extends { id: string; updatedAt: string }>(
  remote: readonly T[],
  local: readonly T[],
): T[] => {
  const byId = new Map<string, T>()
  for (const item of remote) byId.set(item.id, item)
  for (const item of local) {
    const existing = byId.get(item.id)
    if (!existing || timestampOf(item.updatedAt) >= timestampOf(existing.updatedAt)) {
      byId.set(item.id, item)
    }
  }
  return [...byId.values()]
}

/** Надгробия сливаются по id: побеждает более поздняя дата удаления. */
const mergeTombstones = (
  remote: readonly NoteTombstone[] | undefined,
  local: readonly NoteTombstone[] | undefined,
): NoteTombstone[] => {
  const byId = new Map<string, NoteTombstone>()
  // `undefined` защищает от манифеста, записанного более старой версией
  // расширения на другом устройстве: поля там ещё нет.
  for (const tombstone of [...(remote ?? []), ...(local ?? [])]) {
    const existing = byId.get(tombstone.id)
    if (!existing || timestampOf(tombstone.deletedAt) >= timestampOf(existing.deletedAt)) {
      byId.set(tombstone.id, tombstone)
    }
  }
  return [...byId.values()]
}

/** Сколько дней надгробие живёт после удаления. */
export const TOMBSTONE_TTL_DAYS = 30

/**
 * Убирает старые надгробия.
 *
 * Надгробие нужно ровно столько, сколько устройство может не открывать
 * расширение. Тридцати дней хватает с запасом, а без очистки файл рос бы
 * бесконечно: каждое удаление оставляло бы строку навсегда.
 */
export const pruneTombstones = (
  tombstones: readonly NoteTombstone[],
  now: number = Date.now(),
): NoteTombstone[] => {
  const threshold = now - TOMBSTONE_TTL_DAYS * 24 * 60 * 60 * 1000
  return tombstones.filter((tombstone) => timestampOf(tombstone.deletedAt) > threshold)
}

/**
 * Сливает локальные изменения с тем, что лежит на Диске.
 *
 * Побеждает более свежий `updatedAt`. Удаление представлено надгробием: заметка
 * считается удалённой, если её `updatedAt` не позже `deletedAt`. Это и
 * закрывает старый дефект — раньше отсутствие записи было неотличимо от «я эту
 * заметку ещё не видел», и устройство со старой копией возвращало её обратно.
 *
 * Обратный случай тоже важен: если заметку правили позже удаления (возврат
 * после удаления, «Отменить»), побеждает заметка, а надгробие снимается —
 * иначе следующее слияние удалило бы её снова.
 *
 * Очистка старых надгробий здесь не делается: функция остаётся чистой, а
 * срок жизни считается при записи файла (`storage/writes.ts`).
 */
export const mergeManifests = (remote: NotesManifest, local: NotesManifest): NotesManifest => {
  const mergedNotes = mergeById(remote.notes, local.notes)
  const groups = mergeById(remote.groups, local.groups).sort((a, b) => a.order - b.order)
  const mergedTombstones = mergeTombstones(remote.deletedNotes, local.deletedNotes)

  const tombstoneById = new Map(mergedTombstones.map((tombstone) => [tombstone.id, tombstone]))
  const resurrected = new Set<string>()
  const notes = mergedNotes.filter((note) => {
    const tombstone = tombstoneById.get(note.id)
    if (!tombstone) return true
    if (timestampOf(tombstone.deletedAt) >= timestampOf(note.updatedAt)) return false
    // Заметка новее удаления — её вернули.
    resurrected.add(note.id)
    return true
  })

  return {
    version: NOTES_MANIFEST_VERSION,
    updatedAt: new Date().toISOString(),
    groups,
    notes,
    deletedNotes: mergedTombstones.filter((tombstone) => !resurrected.has(tombstone.id)),
  }
}
