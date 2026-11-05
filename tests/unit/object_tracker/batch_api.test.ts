import { describe, expect, it, vi } from 'vitest'
import {
  BATCH_ENDPOINT,
  CsrfTokenRejectedError,
  createFetchTransport,
  getGeoObjectCall,
  getObjectCommitsCall,
  isMissingObjectError,
  parseBatchResponse,
  parseCommitsResult,
  parseGeoObjectResult,
} from '@/lib/object_tracker/batch_api'

const commitsResponse = JSON.stringify({
  data: [
    {
      data: {
        commits: [
          {
            id: '530951820',
            date: '2026-11-05T11:22:11+03:00',
            action: 'object-modified',
            primaryObjectId: '4465652155',
            approveStatus: 'pending',
            state: 'draft',
            user: { publicId: 'stylesvoboda', displayName: 'stylesvoboda' },
          },
        ],
        pager: { totalCount: 3, perPage: 20, page: 1 },
      },
    },
  ],
})

describe('object_tracker: batch calls', () => {
  it('строит вызов истории объекта', () => {
    const call = getObjectCommitsCall('123', 2)

    expect(call.method).toBe('editor/getGeoObjectCommits')
    expect(call.params).toMatchObject({
      id: '123',
      page: 2,
      primaryOnly: false,
      withAssessmentGrades: false,
      branch: '0',
    })
  })

  it('строит вызов объекта', () => {
    expect(getGeoObjectCall('5').method).toBe('editor/getGeoObject')
  })
})

describe('object_tracker: parseBatchResponse', () => {
  it('разбирает успешный ответ', () => {
    const result = parseBatchResponse(commitsResponse)

    expect(result).toHaveLength(1)
    expect(result[0]?.error).toBeUndefined()
  })

  it('переносит ошибку элемента в результат', () => {
    const result = parseBatchResponse(
      JSON.stringify({ data: [{ error: { type: 'ERR_MISSING_OBJECT', message: '' } }] }),
    )

    expect(result[0]?.error?.type).toBe('ERR_MISSING_OBJECT')
  })

  it('возвращает пустой массив на битый JSON', () => {
    expect(parseBatchResponse('не json')).toEqual([])
    expect(parseBatchResponse('{}')).toEqual([])
  })
})

describe('object_tracker: parseCommitsResult', () => {
  it('достаёт коммиты и пагинацию', () => {
    const [result] = parseBatchResponse(commitsResponse)
    const page = parseCommitsResult(result, '4465652155')

    expect(page.totalCount).toBe(3)
    expect(page.perPage).toBe(20)
    expect(page.commits).toHaveLength(1)
    expect(page.commits[0]?.id).toBe('530951820')
  })

  it('возвращает пустую страницу при ошибке', () => {
    const page = parseCommitsResult({ error: { type: 'ERR_MISSING_OBJECT' } }, '1')

    expect(page.commits).toEqual([])
    expect(page.totalCount).toBe(0)
  })
})

describe('object_tracker: parseGeoObjectResult', () => {
  it('определяет отсутствующий объект', () => {
    const info = parseGeoObjectResult({ error: { type: 'ERR_MISSING_OBJECT' } })

    expect(info.exists).toBe(false)
    expect(isMissingObjectError(info.errorType)).toBe(true)
  })

  it('достаёт название и категорию', () => {
    const info = parseGeoObjectResult({
      data: {
        geoObject: {
          title: 'хутор Захаров',
          categoryId: 'ad',
          revisionId: '53161481:307431576',
        },
      },
    })

    expect(info).toEqual({
      exists: true,
      title: 'хутор Захаров',
      categoryId: 'ad',
      revisionId: '53161481:307431576',
    })
  })

  it('скрывает шаблонное название категории', () => {
    const info = parseGeoObjectResult({
      data: { geoObject: { title: '{{categories:ad_jc}}', categoryId: 'ad_jc' } },
    })

    expect(info.exists).toBe(true)
    expect(info.title).toBeNull()
  })
})

describe('object_tracker: createFetchTransport', () => {
  const makeFetch = (status: number, body: string) =>
    vi.fn(async () => new Response(body, { status }))

  it('шлёт batch с CSRF-заголовком и cookies', async () => {
    const fetchFn = makeFetch(200, commitsResponse) as unknown as typeof fetch
    const transport = createFetchTransport(fetchFn)

    await transport([getObjectCommitsCall('1')], 'token-123')

    const [url, init] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe(BATCH_ENDPOINT)
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect(init.headers['x-csrf-token']).toBe('token-123')
  })

  it('не шлёт пустой CSRF-заголовок', async () => {
    const fetchFn = makeFetch(200, '{"data":[]}') as unknown as typeof fetch
    const transport = createFetchTransport(fetchFn)

    await transport([getObjectCommitsCall('1')], '')

    const [, init] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(init.headers['x-csrf-token']).toBeUndefined()
  })

  it('бросает CsrfTokenRejectedError на 403', async () => {
    const fetchFn = makeFetch(403, '') as unknown as typeof fetch
    const transport = createFetchTransport(fetchFn)

    await expect(transport([], 'bad')).rejects.toBeInstanceOf(CsrfTokenRejectedError)
  })

  it('бросает ошибку на прочих неуспешных статусах', async () => {
    const fetchFn = makeFetch(500, '') as unknown as typeof fetch
    const transport = createFetchTransport(fetchFn)

    await expect(transport([], 'token')).rejects.toThrow('HTTP 500')
  })
})
