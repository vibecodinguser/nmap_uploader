import { browser } from 'wxt/browser'
import { logBackgroundTaskFailure } from '@/lib/background/tasks'
import { ensureFolderExists } from '@/lib/yandex/disk_folder_ops'
import { diskResourceExists, moveDiskResource } from '@/lib/yandex/disk_resources'
import { getStoredAuth } from '@/lib/yandex/storage'
import {
  LEGACY_NOTES_FOLDER,
  LEGACY_NOTES_MANIFEST_PATH,
  NOTES_FOLDER,
  NOTES_MANIFEST_PATH,
  NOTES_ROOT_FOLDER,
  setNotesStorageLocation,
} from './paths'

/**
 * Перенос заметок из папки Блокнота картографа в собственный каталог.
 *
 * Раньше заметки лежали в `Приложения/Блокнот картографа Народной карты/notes`.
 * Трекер редактора считает каждый подкаталог Блокнота треком, читает его
 * `index.json` как данные трека и падает на манифесте заметок: в бандле
 * трекера `Object.keys(trackData.points)` получает `undefined`. Кроме того,
 * трек можно удалить из настроек трекера вместе со всеми заметками.
 *
 * Поэтому папка переезжает в `Приложения/Nmap Uploader/notes` — туда трекер
 * не смотрит. Перенос делается одним запросом `move`: шарды, манифест и
 * иконки едут вместе, перечислять и перезагружать файлы не нужно.
 */

type NotesMigrationResult = 'none' | 'moved' | 'archived'

export type NotesMigrationClient = {
  exists: (logicalPath: string) => Promise<boolean>
  move: (from: string, to: string) => Promise<void>
  /** Создаёт родительскую папку назначения: `move` её не создаёт. */
  ensureRoot: () => Promise<void>
}

/** Решает, что делать с прежней папкой заметок. Вынесено ради тестов. */
export const planNotesMigration = async (
  client: NotesMigrationClient,
  now: number = Date.now(),
): Promise<{ action: NotesMigrationResult; from?: string; to?: string }> => {
  const legacyExists = await client.exists(LEGACY_NOTES_MANIFEST_PATH)
  if (!legacyExists) {
    return { action: 'none' }
  }

  const currentExists = await client.exists(NOTES_MANIFEST_PATH)
  if (currentExists) {
    // Заметки уже живут на новом месте: старая папка — устаревшая копия.
    // Её всё равно надо убрать из Блокнота, иначе трекер продолжит её видеть.
    return {
      action: 'archived',
      from: LEGACY_NOTES_FOLDER,
      to: `${NOTES_ROOT_FOLDER}/legacy-notes-${now}`,
    }
  }

  return { action: 'moved', from: LEGACY_NOTES_FOLDER, to: NOTES_FOLDER }
}

/** Миграции по токену: повторные вызовы в рамках сессии не дублируют запросы. */
const migrationsByToken = new Map<string, Promise<NotesMigrationResult>>()

/**
 * Пользователь, для которого перенос уже выполнен.
 *
 * Background просыпается часто, и без отметки каждый запуск делал бы два
 * запроса к Диску. Отметка привязана к пользователю: при входе другим
 * аккаунтом миграция выполнится заново.
 */
export const NOTES_MIGRATION_DONE_KEY = 'notes_storage_migration_done_for'

const readMigrationDoneFor = async (): Promise<string | null> => {
  try {
    const stored = await browser.storage.local.get(NOTES_MIGRATION_DONE_KEY)
    const value = stored[NOTES_MIGRATION_DONE_KEY]
    return typeof value === 'string' ? value : null
  } catch {
    return null
  }
}

const markMigrationDone = async (userId: string): Promise<void> => {
  try {
    await browser.storage.local.set({ [NOTES_MIGRATION_DONE_KEY]: userId })
  } catch (error: unknown) {
    // Отметка — оптимизация: без неё перенос просто проверится ещё раз.
    logBackgroundTaskFailure('notes migration flag', error)
  }
}

const createDiskMigrationClient = (token: string): NotesMigrationClient => ({
  exists: (logicalPath) => diskResourceExists({ logicalPath, token }),
  move: (from, to) => moveDiskResource({ from, to, token }),
  ensureRoot: () => ensureFolderExists({ path: NOTES_ROOT_FOLDER, token }),
})

const runMigration = async (client: NotesMigrationClient): Promise<NotesMigrationResult> => {
  const plan = await planNotesMigration(client)
  if (!plan.from || !plan.to) {
    return plan.action
  }

  await client.ensureRoot()
  await client.move(plan.from, plan.to)
  return plan.action
}

/**
 * Переносит заметки, если они ещё лежат в папке Блокнота.
 *
 * Ошибку пробрасывает наверх: молча продолжить нельзя — чтение пойдёт по
 * новому пути и панель показала бы пустой список, хотя данные целы.
 */
export const migrateLegacyNotesFolder = async ({
  token,
  userId,
  client,
}: {
  token: string
  /** Нужен для отметки «перенос уже сделан»; в тестах не передаётся. */
  userId?: string
  /** Подменяется в тестах. */
  client?: NotesMigrationClient
}): Promise<NotesMigrationResult> => {
  const existing = migrationsByToken.get(token)
  if (existing) return existing

  if (userId && (await readMigrationDoneFor()) === userId) {
    return 'none'
  }

  const migration = runMigration(client ?? createDiskMigrationClient(token))
  migrationsByToken.set(token, migration)

  try {
    const result = await migration
    setNotesStorageLocation('current')
    if (userId) await markMigrationDone(userId)
    return result
  } catch (error: unknown) {
    // Перенос не удался: продолжаем сессию в прежней папке, иначе панель
    // прочитала бы пустой новый путь поверх целых данных. Трекер редактора
    // при этом продолжит видеть папку заметок как трек — до следующей попытки.
    setNotesStorageLocation('legacy')
    // Неудачную попытку повторяем при следующем запуске background.
    migrationsByToken.delete(token)
    throw error
  }
}

/** Запуск из background при старте: перенос не должен ждать открытия панели. */
export const migrateLegacyNotesFolderOnStartup = async (): Promise<void> => {
  try {
    const auth = await getStoredAuth()
    if (!auth) return
    await migrateLegacyNotesFolder({ token: auth.token, userId: auth.user.id })
  } catch (error: unknown) {
    logBackgroundTaskFailure('notes migration', error)
  }
}

/** Сбрасывает кэш миграций: нужен тестам и смене аккаунта. */
export const resetNotesMigrationCache = (): void => {
  migrationsByToken.clear()
}
