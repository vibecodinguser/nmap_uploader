import { describe, expect, it } from 'vitest'
import { getUploadMessagePayload } from '@/lib/background/auth_handlers'

describe('background/auth_handlers', () => {
  describe('getUploadMessagePayload', () => {
    it('корректно извлекает массив файлов и targetDate', () => {
      const payload = getUploadMessagePayload({
        files: [{ name: 'test.geojson' }],
        targetDate: '2026-10-21',
      })
      expect(payload.files).toHaveLength(1)
      expect(payload.targetDate).toBe('2026-10-21')
    })

    it('возвращает пустой массив файлов и undefined targetDate при отсутствии данных', () => {
      const payload = getUploadMessagePayload({})
      expect(payload.files).toEqual([])
      expect(payload.targetDate).toBeUndefined()
    })
  })
})
