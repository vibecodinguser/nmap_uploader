import { processFile } from '@/lib/converters'
import { ProcessingError } from '@/lib/errors'
import type { GeoConvertResult, ProcessGeoFileInput } from './types'

export { extractFeatureName } from './feature_names'
export * from './types'

/**
 * Преобразует геофайл в представление для Блокнота картографа Народной карты Яндекса.
 * Принимает объект с параметрами (RORO pattern) и возвращает Result<T, E> без исключений.
 */
export const processGeoFile = async ({
  buffer,
  fileName,
}: ProcessGeoFileInput): Promise<GeoConvertResult> => {
  try {
    const value = await processFile({ name: fileName, buffer })
    return { ok: true, value }
  } catch (error) {
    if (error instanceof ProcessingError) {
      return {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
        },
      }
    }

    const message = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      error: {
        code: 'ERR_UNKNOWN',
        message: `Ошибка обработки геофайла: ${message}`,
        details: error,
      },
    }
  }
}
