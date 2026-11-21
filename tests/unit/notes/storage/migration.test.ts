import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import {
  migrateLegacyNotesFolder,
  NOTES_MIGRATION_DONE_KEY,
  type NotesMigrationClient,
  planNotesMigration,
  resetNotesMigrationCache,
} from '@/lib/notes/storage/migration'
import {
  LEGACY_NOTES_FOLDER,
  LEGACY_NOTES_MANIFEST_PATH,
  NOTES_FOLDER,
  NOTES_MANIFEST_PATH,
  NOTES_ROOT_FOLDER,
  notesManifestPath,
  notesShardPath,
  setNotesStorageLocation,
} from '@/lib/notes/storage/paths'
import { YANDEX_DISK_FOLDER } from '@/lib/yandex/constants'

type FakeClient = NotesMigrationClient & {
  moved: Array<{ from: string; to: string }>
  ensured: number
}

const createClient = (existing: readonly string[], failMoveOnce = false): FakeClient => {
  const moved: Array<{ from: string; to: string }> = []
  let failed = false
  const ensured = { count: 0 }

  return {
    moved,
    get ensured() {
      return ensured.count
    },
    exists: async (logicalPath) => existing.includes(logicalPath),
    ensureRoot: async () => {
      ensured.count += 1
    },
    move: async (from, to) => {
      if (failMoveOnce && !failed) {
        failed = true
        throw new Error('network')
      }
      moved.push({ from, to })
    },
  }
}

describe('заметки: пути хранения', () => {
  it('держит заметки вне папки Блокнота картографа', () => {
    // Трекер редактора считает подкаталоги Блокнота треками и падает на
    // манифесте заметок, поэтому путь не должен быть вложен в Блокнот.
    expect(NOTES_FOLDER.startsWith(`${YANDEX_DISK_FOLDER}/`)).toBe(false)
    expect(NOTES_FOLDER.startsWith(`${NOTES_ROOT_FOLDER}/`)).toBe(true)
    expect(NOTES_FOLDER).toBe('Приложения/Nmap Uploader/notes')
  })

  it('помнит прежнее место только для миграции', () => {
    expect(LEGACY_NOTES_FOLDER).toBe(`${YANDEX_DISK_FOLDER}/notes`)
    expect(LEGACY_NOTES_MANIFEST_PATH).toBe(`${LEGACY_NOTES_FOLDER}/index.json`)
  })
})

describe('заметки: миграция из папки Блокнота', () => {
  it('ничего не делает, если прежней папки нет', async () => {
    const client = createClient([])

    expect(await planNotesMigration(client)).toEqual({ action: 'none' })
  })

  it('переносит папку на новое место, если новых заметок ещё нет', async () => {
    const client = createClient([LEGACY_NOTES_MANIFEST_PATH])

    expect(await planNotesMigration(client)).toEqual({
      action: 'moved',
      from: LEGACY_NOTES_FOLDER,
      to: NOTES_FOLDER,
    })
  })

  it('убирает устаревшую папку из Блокнота, если заметки уже на новом месте', async () => {
    const client = createClient([LEGACY_NOTES_MANIFEST_PATH, NOTES_MANIFEST_PATH])

    const plan = await planNotesMigration(client, 1_700_000_000_000)

    expect(plan.action).toBe('archived')
    expect(plan.from).toBe(LEGACY_NOTES_FOLDER)
    expect(plan.to).toBe(`${NOTES_ROOT_FOLDER}/legacy-notes-1700000000000`)
    // Архив остаётся вне Блокнота: иначе трекер продолжит видеть папку.
    expect(plan.to?.startsWith(`${YANDEX_DISK_FOLDER}/`)).toBe(false)
  })
})

describe('заметки: запуск миграции', () => {
  beforeEach(() => {
    resetNotesMigrationCache()
    setNotesStorageLocation('current')
  })

  it('выполняет перенос один раз на токен', async () => {
    const client = createClient([LEGACY_NOTES_MANIFEST_PATH])

    expect(await migrateLegacyNotesFolder({ token: 'token', client })).toBe('moved')
    expect(client.ensured).toBe(1)
    expect(client.moved).toEqual([{ from: LEGACY_NOTES_FOLDER, to: NOTES_FOLDER }])

    expect(await migrateLegacyNotesFolder({ token: 'token', client })).toBe('moved')
    expect(client.moved).toHaveLength(1)
  })

  it('повторяет попытку после ошибки', async () => {
    const client = createClient([LEGACY_NOTES_MANIFEST_PATH], true)

    await expect(migrateLegacyNotesFolder({ token: 'token', client })).rejects.toThrow('network')
    expect(await migrateLegacyNotesFolder({ token: 'token', client })).toBe('moved')
    expect(client.moved).toHaveLength(1)
  })

  it('не создаёт папку и не переносит, если мигрировать нечего', async () => {
    const client = createClient([])

    expect(await migrateLegacyNotesFolder({ token: 'token', client })).toBe('none')
    expect(client.moved).toHaveLength(0)
    expect(client.ensured).toBe(0)
  })

  it('после успешного переноса работает с новой папкой', async () => {
    const client = createClient([LEGACY_NOTES_MANIFEST_PATH])

    await migrateLegacyNotesFolder({ token: 'token', client })

    expect(notesManifestPath()).toBe(NOTES_MANIFEST_PATH)
    expect(notesShardPath('2026-11')).toBe(`${NOTES_FOLDER}/geometry/2026-11.json`)
  })

  it('после неудачи продолжает сессию в прежней папке, чтобы не показать пустоту', async () => {
    const client = createClient([LEGACY_NOTES_MANIFEST_PATH], true)

    await expect(migrateLegacyNotesFolder({ token: 'token', client })).rejects.toThrow('network')

    expect(notesManifestPath()).toBe(LEGACY_NOTES_MANIFEST_PATH)
    expect(notesShardPath('2026-11')).toBe(`${LEGACY_NOTES_FOLDER}/geometry/2026-11.json`)
  })

  it('ведёт отдельную миграцию для каждого токена', async () => {
    const first = createClient([LEGACY_NOTES_MANIFEST_PATH])
    const second = createClient([LEGACY_NOTES_MANIFEST_PATH])

    await migrateLegacyNotesFolder({ token: 'first', client: first })
    await migrateLegacyNotesFolder({ token: 'second', client: second })

    expect(first.moved).toHaveLength(1)
    expect(second.moved).toHaveLength(1)
  })
})

describe('заметки: сброс кэша миграции', () => {
  it('снимает запомненный результат', async () => {
    resetNotesMigrationCache()
    setNotesStorageLocation('current')
    const client = createClient([LEGACY_NOTES_MANIFEST_PATH])

    await migrateLegacyNotesFolder({ token: 'token', client })
    resetNotesMigrationCache()
    await migrateLegacyNotesFolder({ token: 'token', client })

    expect(client.moved).toHaveLength(2)
  })
})

describe('заметки: отметка о переносе', () => {
  beforeEach(async () => {
    resetNotesMigrationCache()
    setNotesStorageLocation('current')
    await browser.storage.local.remove(NOTES_MIGRATION_DONE_KEY)
  })

  it('запоминает пользователя после успешного переноса', async () => {
    const client = createClient([LEGACY_NOTES_MANIFEST_PATH])

    await migrateLegacyNotesFolder({ token: 'token', userId: 'user-1', client })

    const stored = await browser.storage.local.get(NOTES_MIGRATION_DONE_KEY)
    expect(stored[NOTES_MIGRATION_DONE_KEY]).toBe('user-1')
  })

  it('не ходит на Диск, если перенос уже сделан для этого пользователя', async () => {
    await browser.storage.local.set({ [NOTES_MIGRATION_DONE_KEY]: 'user-1' })
    const exists = vi.fn(async () => true)

    const result = await migrateLegacyNotesFolder({
      token: 'token',
      userId: 'user-1',
      client: { exists, move: vi.fn(), ensureRoot: vi.fn() },
    })

    expect(result).toBe('none')
    expect(exists).not.toHaveBeenCalled()
  })

  it('проверяет Диск заново для другого пользователя', async () => {
    await browser.storage.local.set({ [NOTES_MIGRATION_DONE_KEY]: 'user-1' })
    const client = createClient([LEGACY_NOTES_MANIFEST_PATH])

    expect(await migrateLegacyNotesFolder({ token: 'token', userId: 'user-2', client })).toBe(
      'moved',
    )
    expect(client.moved).toHaveLength(1)
  })

  it('не ставит отметку, если перенос не удался', async () => {
    const client = createClient([LEGACY_NOTES_MANIFEST_PATH], true)

    await expect(
      migrateLegacyNotesFolder({ token: 'token', userId: 'user-1', client }),
    ).rejects.toThrow('network')

    const stored = await browser.storage.local.get(NOTES_MIGRATION_DONE_KEY)
    expect(stored[NOTES_MIGRATION_DONE_KEY]).toBeUndefined()
  })
})
