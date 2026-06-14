import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { createNmapOutputTemplate } from '@/lib/nmap_index'
import {
  downloadIndexJson,
  ensureStorageFolders,
  resolveFolderPath,
  uploadIndexJson,
  verifyDiskAccess,
  YANDEX_DISK_FOLDER,
} from '@/lib/yandex/client'
import { server } from '@/tests/setup/vitest.setup'
import {
  getCreatedPaths,
  seedIndexJson,
  simulateParentNotFoundOnPut,
} from '@/tests/setup/yandex_handlers'

const DISK_API = 'https://cloud-api.yandex.net/v1/disk'

describe('Yandex Disk', () => {
  const token = 'test-token'
  const baseFolderPath = `/${YANDEX_DISK_FOLDER}`

  it('verifyDiskAccess: успешная проверка токена', async () => {
    await expect(verifyDiskAccess({ token })).resolves.toBeUndefined()
  })

  it('verifyDiskAccess: 401 для просроченного токена', async () => {
    await expect(verifyDiskAccess({ token: 'expired-token' })).rejects.toMatchObject({
      message: expect.stringContaining('Выйдите и войдите'),
    })
  })

  it('ensureStorageFolders: создаёт «Приложения», базовую и дневную папки', async () => {
    await expect(ensureStorageFolders({ token })).resolves.toBeUndefined()

    const createdPaths = getCreatedPaths()
    expect(createdPaths).toContain('/Приложения')
    expect(createdPaths).toContain(baseFolderPath)
    expect(createdPaths.some((path) => path.startsWith(`${baseFolderPath}/`))).toBe(true)
  })

  it('ensureStorageFolders: идемпотентен при повторном вызове', async () => {
    await ensureStorageFolders({ token })
    const pathsAfterFirstCall = getCreatedPaths()

    await ensureStorageFolders({ token })

    expect(getCreatedPaths()).toEqual(pathsAfterFirstCall)
  })

  it('ensureStorageFolders: при 409 DiskPathDoesntExistsError создаёт родителя и повторяет', async () => {
    simulateParentNotFoundOnPut(baseFolderPath)

    await expect(ensureStorageFolders({ token })).resolves.toBeUndefined()
    expect(getCreatedPaths()).toContain('/Приложения')
    expect(getCreatedPaths()).toContain(baseFolderPath)
  })

  it('resolveFolderPath: добавляет дату в путь', () => {
    expect(resolveFolderPath({ targetDate: '2026-05-24' })).toBe(`${YANDEX_DISK_FOLDER}/2026-05-24`)
  })

  it('downloadIndexJson: возвращает null, если index.json отсутствует', async () => {
    const result = await downloadIndexJson({ token, targetDate: '2026-05-24' })
    expect(result).toBeNull()
  })

  it('downloadIndexJson: скачивает существующий index.json', async () => {
    const existing = createNmapOutputTemplate()
    existing.points.point1 = { coords: [37.6, 55.7], desc: 'test' }
    seedIndexJson(existing)

    const result = await downloadIndexJson({ token, targetDate: '2026-05-24' })

    expect(result).toEqual(existing)
  })

  it('uploadIndexJson: загружает index.json на Диск', async () => {
    const data = createNmapOutputTemplate()
    data.paths.path1 = [[37.6, 55.7]]

    await expect(
      uploadIndexJson({ token, data, targetDate: '2026-05-24' }),
    ).resolves.toBeUndefined()

    const downloaded = await downloadIndexJson({ token, targetDate: '2026-05-24' })
    expect(downloaded).toEqual(data)
  })

  it('uploadIndexJson: отклоняет подменённый href вне доменов Яндекс.Диска', async () => {
    server.use(
      http.get(`${DISK_API}/resources/upload`, () =>
        HttpResponse.json({ href: 'https://evil.com/upload' }),
      ),
    )

    const data = createNmapOutputTemplate()
    await expect(uploadIndexJson({ token, data, targetDate: '2026-05-24' })).rejects.toMatchObject({
      message: expect.stringContaining('Недопустимый URL'),
    })
  })

  it('downloadIndexJson: отклоняет подменённый href вне доменов Яндекс.Диска', async () => {
    seedIndexJson(createNmapOutputTemplate())
    server.use(
      http.get(`${DISK_API}/resources/download`, () =>
        HttpResponse.json({ href: 'https://evil.com/download' }),
      ),
    )

    await expect(downloadIndexJson({ token, targetDate: '2026-05-24' })).rejects.toMatchObject({
      message: expect.stringContaining('Недопустимый URL'),
    })
  })
})
