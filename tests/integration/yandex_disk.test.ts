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
import { seedIndexJson } from '@/tests/setup/yandex_handlers'

describe('Yandex Disk', () => {
  const token = 'test-token'

  it('verifyDiskAccess: успешная проверка токена', async () => {
    await expect(verifyDiskAccess({ token })).resolves.toBeUndefined()
  })

  it('verifyDiskAccess: 401 для просроченного токена', async () => {
    await expect(verifyDiskAccess({ token: 'expired-token' })).rejects.toMatchObject({
      message: expect.stringContaining('Выйдите и войдите'),
    })
  })

  it('ensureStorageFolders: создаёт базовую и дневную папки', async () => {
    await expect(ensureStorageFolders({ token })).resolves.toBeUndefined()
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
})
