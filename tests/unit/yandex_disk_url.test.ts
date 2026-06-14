import { describe, expect, it } from 'vitest'
import { ERR_NETWORK } from '@/lib/errors'
import { assertAllowedDiskHref, isAllowedDiskHref } from '@/lib/yandex/disk_url'

describe('yandex disk href allowlist', () => {
  it('пропускает URL downloader и uploader Яндекс.Диска', () => {
    expect(isAllowedDiskHref('https://downloader.disk.yandex.ru/mock-index')).toBe(true)
    expect(isAllowedDiskHref('https://uploader.disk.yandex.ru/mock-index')).toBe(true)
    expect(isAllowedDiskHref('https://disk.yandex.ru/disk/abc')).toBe(true)
  })

  it('отклоняет HTTP, чужие домены и некорректные URL', () => {
    expect(isAllowedDiskHref('http://downloader.disk.yandex.ru/mock-index')).toBe(false)
    expect(isAllowedDiskHref('https://evil.com/mock-index')).toBe(false)
    expect(isAllowedDiskHref('https://cloud-api.yandex.net/v1/disk/')).toBe(false)
    expect(isAllowedDiskHref('javascript:alert(1)')).toBe(false)
    expect(isAllowedDiskHref('')).toBe(false)
  })

  it('assertAllowedDiskHref выбрасывает ProcessingError для недопустимого href', () => {
    expect(() => assertAllowedDiskHref('https://evil.com/')).toThrowError(
      expect.objectContaining({
        code: ERR_NETWORK,
        message: expect.stringContaining('Недопустимый URL'),
      }),
    )
  })
})
