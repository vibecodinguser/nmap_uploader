import { normalizeCommits } from './commit_normalizer'
import type { ObjectHistoryPage } from './types'

/** Один вызов внутри batch-запроса. */
export interface BatchCall {
  method: string
  params: Record<string, unknown>
}

export interface BatchError {
  type: string
  message?: string
}

export interface BatchResult {
  data?: unknown
  error?: BatchError
}

/** Транспорт batch-запроса: подменяется в тестах. */
export type BatchTransport = (calls: BatchCall[], token: string) => Promise<BatchResult[]>

export const BATCH_ENDPOINT = '/api/v2/batch'

const BASE_PARAMS = { token: '', branch: '0' } as const

/** Вызов истории объекта. Первая страница — последние 20 коммитов. */
export const getObjectCommitsCall = (objectId: string, page = 1): BatchCall => ({
  method: 'editor/getGeoObjectCommits',
  params: {
    id: objectId,
    primaryOnly: false,
    withAssessmentGrades: false,
    page,
    ...BASE_PARAMS,
  },
})

/** Вызов самого объекта: нужен для проверки существования и названия. */
export const getGeoObjectCall = (objectId: string): BatchCall => ({
  method: 'editor/getGeoObject',
  params: { id: objectId, ...BASE_PARAMS },
})

/**
 * Разбирает тело ответа batch.
 *
 * Сервер всегда отвечает 200, а ошибки кладёт внутрь элемента массива,
 * поэтому проверять HTTP-статус недостаточно.
 */
export const parseBatchResponse = (text: string): BatchResult[] => {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return []
  }

  if (!parsed || typeof parsed !== 'object') {
    return []
  }

  const data = (parsed as { data?: unknown }).data
  if (!Array.isArray(data)) {
    return []
  }

  return data.map((item): BatchResult => {
    if (!item || typeof item !== 'object') {
      return {}
    }
    const record = item as Record<string, unknown>

    if (record.error && typeof record.error === 'object') {
      const error = record.error as Record<string, unknown>
      return {
        error: {
          type: typeof error.type === 'string' ? error.type : 'UNKNOWN',
          message: typeof error.message === 'string' ? error.message : undefined,
        },
      }
    }

    return { data: record.data }
  })
}

/** Достаёт страницу истории из результата вызова. */
export const parseCommitsResult = (
  result: BatchResult | undefined,
  objectId: string,
): ObjectHistoryPage => {
  const payload = result?.data as
    | { commits?: unknown; pager?: { totalCount?: unknown; page?: unknown; perPage?: unknown } }
    | undefined

  const commits = normalizeCommits(payload?.commits, objectId)
  const totalCount =
    typeof payload?.pager?.totalCount === 'number' ? payload.pager.totalCount : commits.length
  const page = typeof payload?.pager?.page === 'number' ? payload.pager.page : 1
  const perPage =
    typeof payload?.pager?.perPage === 'number' ? payload.pager.perPage : commits.length

  return { commits, totalCount, page, perPage }
}

export interface GeoObjectInfo {
  exists: boolean
  errorType?: string
  title: string | null
  categoryId: string | null
  revisionId: string | null
}

const CATEGORY_TITLE_PATTERN = /^\{\{categories:([a-z0-9_-]+)\}\}$/i

/**
 * Достаёт сведения об объекте.
 *
 * `title` может быть шаблоном `{{categories:ad_jc}}`: такой объект показываем
 * по id, пока не найдём человекочитаемое имя категории.
 */
export const parseGeoObjectResult = (result: BatchResult | undefined): GeoObjectInfo => {
  if (result?.error) {
    return {
      exists: false,
      errorType: result.error.type,
      title: null,
      categoryId: null,
      revisionId: null,
    }
  }

  const payload = result?.data as
    | {
        geoObject?: {
          title?: unknown
          categoryId?: unknown
          revisionId?: unknown
        }
      }
    | undefined

  const geoObject = payload?.geoObject
  if (!geoObject) {
    return { exists: false, errorType: 'EMPTY', title: null, categoryId: null, revisionId: null }
  }

  const rawTitle = typeof geoObject.title === 'string' ? geoObject.title : ''
  const isTemplate = CATEGORY_TITLE_PATTERN.test(rawTitle)

  return {
    exists: true,
    title: isTemplate ? null : rawTitle,
    categoryId: typeof geoObject.categoryId === 'string' ? geoObject.categoryId : null,
    revisionId: typeof geoObject.revisionId === 'string' ? geoObject.revisionId : null,
  }
}

/** Проверяет, что ошибка означает отсутствие объекта, а не сбой запроса. */
export const isMissingObjectError = (errorType: string | undefined): boolean =>
  errorType === 'ERR_MISSING_OBJECT'

/**
 * Создаёт транспорт batch через `fetch` страницы.
 *
 * Запрос идёт из content script: cookies браузера отправляются автоматически,
 * а CSRF-токен приходит из MAIN world (см. `csrf_capture.ts`).
 */
export const createFetchTransport = (fetchFn: typeof fetch): BatchTransport => {
  return async (calls, token) => {
    const headers: Record<string, string> = {
      'content-type': 'text/plain;charset=UTF-8',
      'x-lang': 'ru',
    }
    if (token) {
      headers['x-csrf-token'] = token
    }

    const response = await fetchFn(BATCH_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(calls),
      credentials: 'include',
    })

    if (response.status === 403) {
      throw new CsrfTokenRejectedError()
    }

    if (!response.ok) {
      throw new Error(`batch failed: HTTP ${response.status}`)
    }

    return parseBatchResponse(await response.text())
  }
}

/** Токен не принят: обычно протух, нужно перечитать из нового запроса приложения. */
export class CsrfTokenRejectedError extends Error {
  constructor() {
    super('CSRF token rejected')
    this.name = 'CsrfTokenRejectedError'
  }
}
