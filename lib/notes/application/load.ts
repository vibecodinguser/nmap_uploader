import type { NotesData, NotesPatch, NotesSnapshot } from '../protocol'
import { loadCachedSnapshot, loadRemoteSnapshot, type NotesPorts } from '../storage/repository'

/**
 * Загрузка снимка и память об уже прочитанном состоянии.
 *
 * Background — единственный долгоживущий контекст, поэтому последний снимок
 * хранится здесь: панель при повторном открытии получает ответ, не дожидаясь
 * Диска. Память принадлежит приложению, а не транспорту, поэтому лежит рядом с
 * загрузкой, а не в обработчике сообщений.
 */

let lastSnapshot: NotesData | null = null

export const currentSnapshot = (): NotesData | null => lastSnapshot

export const rememberSnapshot = (data: NotesData): void => {
  lastSnapshot = data
}

/** Сброс памяти: нужен тестам и смене аккаунта. */
export const forgetSnapshot = (): void => {
  lastSnapshot = null
}

/**
 * План загрузки: что можно отдать сразу и как дочитать с Диска.
 *
 * Кэш и память отдаются до сети — панель открывается мгновенно, а свежие
 * данные доезжают широковещательным снимком.
 */
export type NotesLoadPlan = {
  cached: NotesData | null
  fresh: () => Promise<NotesData>
}

export const planNotesLoad = async (ports: NotesPorts): Promise<NotesLoadPlan> => ({
  cached: lastSnapshot ?? (await loadCachedSnapshot(ports)),
  fresh: () => loadRemoteSnapshot(ports),
})

/** Скрытие живёт в `storage.local`, поэтому читается при каждой выдаче снимка. */
export const withHiddenIds = async (
  data: NotesData,
  readHiddenIds: () => Promise<string[]>,
): Promise<NotesSnapshot> => ({ ...data, hiddenIds: await readHiddenIds() })

/**
 * Накладывает ответ мутации на предыдущее состояние.
 *
 * Патч несёт манифест целиком и только затронутые шарды: остальные остаются
 * от прошлого снимка, иначе одно сохранение стирало бы геометрию других дат.
 */
export const applyPatch = (base: NotesData | null, patch: NotesPatch): NotesData => ({
  manifest: patch.manifest,
  shards: { ...(base?.shards ?? {}), ...patch.shards },
})
