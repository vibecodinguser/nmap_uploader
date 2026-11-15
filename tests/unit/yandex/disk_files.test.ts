/**
 * Проверки адаптера произвольных файлов на Диске.
 *
 * Главный сценарий — первый запуск: папок `notes/geometry` ещё нет, а Яндекс
 * отвечает на запрос ссылки на загрузку `409 CONFLICT`, если родителя нет.
 */
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { NOTES_GEOMETRY_FOLDER, NOTES_MANIFEST_PATH } from '@/lib/notes/storage/paths'
import { downloadDiskText, uploadDiskFile } from '@/lib/yandex/disk_files'
import { server } from '@/tests/setup/vitest.setup'
import { getCreatedPaths } from '@/tests/setup/yandex_handlers'

const DISK_API = 'https://cloud-api.yandex.net/v1/disk'
const UPLOADER = 'https://uploader.disk.yandex.ru/mock-notes-file'
const shardPath = `${NOTES_GEOMETRY_FOLDER}/2026-11.json`

/**
 * Подменяет загрузку файла на универсальную.
 *
 * Общий мок Диска умеет только `index.json` Блокнота, а заметки пишут
 * манифест, шарды и иконки.
 */
const installFileUploader = ({ conflictOnce }: { conflictOnce?: string } = {}): (() => boolean) => {
  let conflicted = false

  server.use(
    http.get(`${DISK_API}/resources/upload`, ({ request }) => {
      const path = new URL(request.url).searchParams.get('path') ?? ''
      if (conflictOnce && path.includes(conflictOnce) && !conflicted) {
        conflicted = true
        return new HttpResponse(null, { status: 409, statusText: 'CONFLICT' })
      }
      return HttpResponse.json({ href: UPLOADER })
    }),
    http.put(UPLOADER, () => new HttpResponse(null, { status: 201 })),
  )

  return () => conflicted
}

const recordRequests = (): { seen: string[]; stop: () => void } => {
  const seen: string[] = []
  const listener = ({ request }: { request: Request }) => {
    const url = new URL(request.url)
    if (url.origin !== 'https://cloud-api.yandex.net') return
    seen.push(`${request.method} ${url.pathname} ${url.searchParams.get('path') ?? ''}`)
  }

  server.events.on('request:start', listener)
  return { seen, stop: () => server.events.removeListener('request:start', listener) }
}

/** Уникальный токен на тест: кэш созданных папок живёт по отпечатку токена. */
const tokenFor = (name: string): string => `token-${name}`

describe('uploadDiskFile', () => {
  beforeEach(() => {
    installFileUploader()
  })

  it('создаёт родительские папки до запроса ссылки на загрузку', async () => {
    const { seen, stop } = recordRequests()

    await uploadDiskFile({ logicalPath: shardPath, token: tokenFor('order'), body: '{}' })
    stop()

    const uploadIndex = seen.findIndex((entry) => entry.includes('/upload'))
    const lastFolderPut = seen.reduce(
      (last, entry, index) => (entry.startsWith('PUT /v1/disk/resources') ? index : last),
      -1,
    )

    expect(uploadIndex).toBeGreaterThan(-1)
    expect(lastFolderPut).toBeGreaterThan(-1)
    expect(lastFolderPut).toBeLessThan(uploadIndex)
  })

  it('создаёт всю цепочку папок, включая notes и geometry', async () => {
    await uploadDiskFile({ logicalPath: shardPath, token: tokenFor('chain'), body: '{}' })

    const created = getCreatedPaths()
    expect(created.some((path) => path.endsWith('/notes'))).toBe(true)
    expect(created.some((path) => path.endsWith('/notes/geometry'))).toBe(true)
  })

  it('пишет манифест в папку notes', async () => {
    await uploadDiskFile({
      logicalPath: NOTES_MANIFEST_PATH,
      token: tokenFor('manifest'),
      body: '{}',
    })

    expect(getCreatedPaths().some((path) => path.endsWith('/notes'))).toBe(true)
  })

  it('повторная запись в ту же папку не пересоздаёт её', async () => {
    const token = tokenFor('cache')
    await uploadDiskFile({ logicalPath: shardPath, token, body: '{}' })

    const { seen, stop } = recordRequests()
    await uploadDiskFile({ logicalPath: shardPath, token, body: '{}' })
    stop()

    expect(seen.filter((entry) => entry.startsWith('PUT /v1/disk/resources'))).toEqual([])
  })

  it('переживает CONFLICT: пересоздаёт папку и повторяет запрос', async () => {
    const wasConflicted = installFileUploader({ conflictOnce: '/notes/geometry' })

    await expect(
      uploadDiskFile({ logicalPath: shardPath, token: tokenFor('conflict'), body: '{}' }),
    ).resolves.toBeUndefined()
    expect(wasConflicted()).toBe(true)
  })
})

describe('downloadDiskText', () => {
  it('возвращает null, если файла нет', async () => {
    const text = await downloadDiskText({
      logicalPath: `${NOTES_GEOMETRY_FOLDER}/1999-01.json`,
      token: 'token-download',
    })
    expect(text).toBeNull()
  })
})
