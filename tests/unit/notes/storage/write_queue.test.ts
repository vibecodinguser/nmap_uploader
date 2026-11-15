/**
 * Записи заметок идут строго по одной.
 *
 * Регрессия: параллельные сохранения писали один и тот же шард, и Яндекс.Диск
 * отвечал `423 LOCKED` («ресурс занят другой записью»).
 */
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { NOTES_GEOMETRY_FOLDER } from '@/lib/notes/storage/paths'
import { enqueueNotesWrite, whenNotesWritesIdle } from '@/lib/notes/storage/write_queue'
import { uploadDiskFile } from '@/lib/yandex/disk_files'
import { server } from '@/tests/setup/vitest.setup'

const DISK_API = 'https://cloud-api.yandex.net/v1/disk'
const UPLOADER = 'https://uploader.disk.yandex.ru/mock-notes-file'
const shardPath = `${NOTES_GEOMETRY_FOLDER}/2026-11.json`

const installUploader = (hrefResponses: Array<() => Response>): { calls: () => number } => {
  let call = 0

  server.use(
    http.get(`${DISK_API}/resources/upload`, () => {
      const factory = hrefResponses[Math.min(call, hrefResponses.length - 1)]
      call += 1
      return factory()
    }),
    http.put(UPLOADER, () => new HttpResponse(null, { status: 201 })),
  )

  return { calls: () => call }
}

describe('очередь записи заметок', () => {
  it('выполняет задачи последовательно', async () => {
    const log: string[] = []

    const first = enqueueNotesWrite(async () => {
      log.push('start-1')
      await new Promise((resolve) => setTimeout(resolve, 20))
      log.push('end-1')
    })
    const second = enqueueNotesWrite(async () => {
      log.push('start-2')
      log.push('end-2')
    })

    await Promise.all([first, second])

    expect(log).toEqual(['start-1', 'end-1', 'start-2', 'end-2'])
  })

  it('ошибка одной задачи не ломает очередь', async () => {
    const failing = enqueueNotesWrite(async () => {
      throw new Error('boom')
    })
    const next = enqueueNotesWrite(async () => 'ok')

    await expect(failing).rejects.toThrow('boom')
    await expect(next).resolves.toBe('ok')
  })

  it('whenNotesWritesIdle дожидается всех задач', async () => {
    let finished = false
    void enqueueNotesWrite(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      finished = true
    })

    await whenNotesWritesIdle()
    expect(finished).toBe(true)
  })
})

describe('uploadDiskFile: повтор при LOCKED', () => {
  it('повторяет запрос, если Диск ответил 423, и в итоге сохраняет файл', async () => {
    const uploader = installUploader([
      () => new HttpResponse(null, { status: 423, statusText: 'LOCKED' }),
      () => HttpResponse.json({ href: UPLOADER }),
    ])

    await expect(
      uploadDiskFile({ logicalPath: shardPath, token: 'token-retry', body: '{}' }),
    ).resolves.toBeUndefined()
    expect(uploader.calls()).toBe(2)
  })

  it('сдаётся после исчерпания повторов и показывает статус', async () => {
    installUploader([() => new HttpResponse(null, { status: 423, statusText: 'LOCKED' })])

    await expect(
      uploadDiskFile({ logicalPath: shardPath, token: 'token-giveup', body: '{}' }),
    ).rejects.toThrow(/LOCKED/)
  })

  it('не повторяет запрос на фатальную ошибку', async () => {
    const uploader = installUploader([
      () => new HttpResponse(null, { status: 403, statusText: 'Forbidden' }),
    ])

    await expect(
      uploadDiskFile({ logicalPath: shardPath, token: 'token-forbidden', body: '{}' }),
    ).rejects.toThrow(/Forbidden/)
    expect(uploader.calls()).toBe(1)
  })
})
