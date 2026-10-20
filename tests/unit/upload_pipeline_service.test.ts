import { describe, expect, it, vi } from 'vitest'
import type { TranslateFn } from '@/lib/i18n'
import {
  executeUploadPipeline,
  type UploadPipelineDependencies,
} from '@/lib/upload_pipeline_service'

describe('UploadPipelineService (TDD)', () => {
  const dummyFile = {
    name: 'test.geojson',
    arrayBuffer: async () =>
      new TextEncoder().encode(
        JSON.stringify({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [37.6, 55.7] },
              properties: {},
            },
          ],
        }),
      ).buffer,
  } as unknown as File

  const mockTranslate: TranslateFn = (key: string, params?: Record<string, string | number>) => {
    if (params?.file) {
      return `${key}:${String(params.file)}`
    }
    return key
  }

  it('успешно проводит файл по всему пайплайну: auth -> convert -> upload -> reload', async () => {
    const progressSteps: number[] = []
    const mockDeps: UploadPipelineDependencies = {
      ensureAuth: vi.fn().mockResolvedValue({ ok: true }),
      uploadProcessedFiles: vi.fn().mockResolvedValue({
        ok: true,
        logs: [{ level: 'success', message: 'Загружено на карту' }],
      }),
      invalidateCache: vi.fn(),
      triggerReload: vi.fn().mockResolvedValue(undefined),
      getReloadPreference: vi.fn().mockResolvedValue(true),
      t: mockTranslate,
    }

    const result = await executeUploadPipeline({
      file: dummyFile,
      rawDate: '20-10-2026',
      deps: mockDeps,
      onProgress: (p) => progressSteps.push(p),
    })

    expect(result.ok).toBe(true)
    expect(mockDeps.ensureAuth).toHaveBeenCalledTimes(1)
    expect(mockDeps.uploadProcessedFiles).toHaveBeenCalledTimes(1)
    expect(mockDeps.invalidateCache).toHaveBeenCalledTimes(1)
    expect(mockDeps.triggerReload).toHaveBeenCalledWith({ reloadAfterUpload: true, uploadOk: true })
    expect(progressSteps).toContain(100)
  })

  it('возвращает ошибку, если дата имеет невалидный формат, не запуская конвертацию', async () => {
    const mockDeps: UploadPipelineDependencies = {
      ensureAuth: vi.fn(),
      uploadProcessedFiles: vi.fn(),
      invalidateCache: vi.fn(),
      triggerReload: vi.fn(),
      getReloadPreference: vi.fn(),
      t: mockTranslate,
    }

    const result = await executeUploadPipeline({
      file: dummyFile,
      rawDate: 'invalid-date-format',
      deps: mockDeps,
    })

    expect(result.ok).toBe(false)
    expect(mockDeps.ensureAuth).not.toHaveBeenCalled()
    expect(mockDeps.uploadProcessedFiles).not.toHaveBeenCalled()
  })

  it('возвращает ошибку авторизации, если ensureAuth вернул false', async () => {
    const mockDeps: UploadPipelineDependencies = {
      ensureAuth: vi.fn().mockResolvedValue({ ok: false, message: 'Нужна авторизация' }),
      uploadProcessedFiles: vi.fn(),
      invalidateCache: vi.fn(),
      triggerReload: vi.fn(),
      getReloadPreference: vi.fn(),
      t: mockTranslate,
    }

    const result = await executeUploadPipeline({
      file: dummyFile,
      rawDate: '',
      deps: mockDeps,
    })

    expect(result.ok).toBe(false)
    expect(result.status.message).toBe('Нужна авторизация')
    expect(mockDeps.uploadProcessedFiles).not.toHaveBeenCalled()
  })
})
