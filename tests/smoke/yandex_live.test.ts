import { describe, expect, it } from 'vitest'
import { ensureStorageFolders, verifyDiskAccess } from '@/lib/yandex/client'

const getLiveToken = (): string | undefined => process.env.YANDEX_TEST_TOKEN

describe.skipIf(!getLiveToken())('Yandex live smoke', () => {
  it('токен валиден и папки приложения доступны', async () => {
    const token = getLiveToken()
    if (!token) return

    await verifyDiskAccess({ token })
    await ensureStorageFolders({ token })
    expect(true).toBe(true)
  })
})

describe('Yandex live smoke', () => {
  it('пропускается без YANDEX_TEST_TOKEN', () => {
    if (getLiveToken()) return
    expect(process.env.YANDEX_TEST_TOKEN).toBeUndefined()
  })
})
