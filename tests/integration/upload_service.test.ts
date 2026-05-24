import { beforeEach, describe, expect, it } from 'vitest'
import { createNmapOutputTemplate, type ProcessResult } from '@/lib/nmap_index'
import { uploadProcessedFilesToYandexDisk } from '@/lib/upload_service'
import { clearAuth, saveAuth } from '@/lib/yandex/client'

const createProcessResult = (): ProcessResult => ({
  ...createNmapOutputTemplate(),
  metadata: [],
})

describe('uploadProcessedFilesToYandexDisk', () => {
  beforeEach(async () => {
    await saveAuth({
      token: 'test-token',
      user: { id: '123', login: 'testuser' },
    })
  })

  it('полный happy-path для одного файла', async () => {
    const result = await uploadProcessedFilesToYandexDisk({
      files: [{ name: 'test.geojson', result: createProcessResult() }],
    })

    expect(result.ok).toBe(true)
    expect(result.processedCount).toBe(1)
    expect(result.logs.some((log) => log.message === 'Завершено: файл загружен')).toBe(true)
  })

  it('без файлов возвращает ошибку', async () => {
    const result = await uploadProcessedFilesToYandexDisk({ files: [] })

    expect(result.ok).toBe(false)
    expect(result.logs.at(-1)?.message).toBe('Нет данных для загрузки')
  })

  it('без авторизации возвращает ошибку', async () => {
    await clearAuth()

    const result = await uploadProcessedFilesToYandexDisk({
      files: [{ name: 'test.geojson', result: createProcessResult() }],
    })

    expect(result.ok).toBe(false)
    expect(result.logs.at(-1)?.message).toBe('Необходима авторизация. Войдите через Яндекс ID')
  })

  it('при недействительном токене возвращает ошибку доступа', async () => {
    await saveAuth({
      token: 'expired-token',
      user: { id: '1', login: 'expired' },
    })

    const result = await uploadProcessedFilesToYandexDisk({
      files: [{ name: 'test.geojson', result: createProcessResult() }],
    })

    expect(result.ok).toBe(false)
    expect(result.logs.some((log) => log.level === 'error')).toBe(true)
  })
})
