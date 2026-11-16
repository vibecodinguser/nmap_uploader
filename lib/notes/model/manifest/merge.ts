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

/**
 * Сливает локальные изменения с тем, что лежит на Диске.
 *
 * Побеждает более свежий `updatedAt`. Удаления сюда не попадают: они идут
 * отдельными операциями, которые читают серверную копию и пишут результат.
 * Поэтому слияние аддитивное — заметка, удалённая на другом устройстве,
 * исчезнет из уже открытой панели только после полной перезагрузки снимка.
 */
export const mergeManifests = (remote: NotesManifest, local: NotesManifest): NotesManifest => {
  const notes = mergeById(remote.notes, local.notes)
  const groups = mergeById(remote.groups, local.groups).sort((a, b) => a.order - b.order)

  return {
    version: NOTES_MANIFEST_VERSION,
    updatedAt: new Date().toISOString(),
    groups,
    notes,
  }
}
