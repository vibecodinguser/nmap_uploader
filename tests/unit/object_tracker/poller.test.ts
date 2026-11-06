import { describe, expect, it, vi } from 'vitest'
import { CsrfTokenRejectedError, parseBatchResponse } from '@/lib/object_tracker/batch_api'
import {
  buildReadMarks,
  computeNewCommits,
  countNewCommits,
  mergeCachedCommits,
  pollTrackedObjects,
} from '@/lib/object_tracker/poller'
import type { ObjectCommit, TrackedObject } from '@/lib/object_tracker/types'

const commit = (id: string, date: string): ObjectCommit => ({
  id,
  objectId: '1',
  date,
  action: 'object-modified',
  approveStatus: 'published',
  state: 'approved',
  primary: true,
  author: null,
  summary: '',
})

const objects: TrackedObject[] = [
  { id: '1', title: 'Объект 1', categoryId: 'ad', addedAt: 0 },
  { id: '2', title: 'Объект 2', categoryId: 'rd', addedAt: 0 },
]

const okResponse = (commitsByIndex: ObjectCommit[][]) =>
  JSON.stringify({
    data: commitsByIndex.map((commits) => ({
      data: { commits, pager: { totalCount: commits.length, perPage: 20, page: 1 } },
    })),
  })

describe('object_tracker: computeNewCommits', () => {
  const commits = [commit('3', '2026-11-03'), commit('2', '2026-11-02'), commit('1', '2026-11-01')]

  it('возвращает коммиты новее отметки прочтения', () => {
    expect(computeNewCommits(commits, '2').map((item) => item.id)).toEqual(['3'])
  })

  it('возвращает пусто, если отметка указывает на самый свежий', () => {
    expect(computeNewCommits(commits, '3')).toEqual([])
  })

  it('возвращает пусто, если отметки нет', () => {
    expect(computeNewCommits(commits, undefined)).toEqual([])
  })

  it('возвращает всё, если отметки нет в списке', () => {
    expect(computeNewCommits(commits, 'старый').map((item) => item.id)).toEqual(['3', '2', '1'])
  })
})

describe('object_tracker: pollTrackedObjects', () => {
  it('опрашивает все объекты одним batch-запросом', async () => {
    const transport = vi.fn(async () => parseBatchResponse(okResponse([[], []])))

    await pollTrackedObjects({ transport, token: 'token' }, objects, {})

    expect(transport).toHaveBeenCalledTimes(1)
    expect(transport.mock.calls[0]?.[0]).toHaveLength(2)
  })

  it('собирает новые коммиты по отметкам прочтения', async () => {
    const transport = vi.fn(async () =>
      parseBatchResponse(
        okResponse([
          [commit('10', '2026-11-05'), commit('9', '2026-11-04')],
          [commit('20', '2026-11-03'), commit('19', '2026-11-02')],
        ]),
      ),
    )

    const result = await pollTrackedObjects({ transport, token: 'token' }, objects, {
      '1': '9',
      '2': '20',
    })

    expect(result.newCommits.map((item) => item.id)).toEqual(['10'])
    expect(countNewCommits(result)).toBe(1)
  })

  it('сообщает об ошибке по конкретному объекту', async () => {
    const transport = vi.fn(async () => [
      { error: { type: 'ERR_MISSING_OBJECT' } },
      { data: { commits: [], pager: { totalCount: 0, perPage: 20, page: 1 } } },
    ])

    const result = await pollTrackedObjects({ transport, token: 'token' }, objects, {})

    expect(result.errors['1']).toBe('ERR_MISSING_OBJECT')
    expect(result.errors['2']).toBeUndefined()
  })

  it('не ходит в сеть без токена', async () => {
    const transport = vi.fn()

    const result = await pollTrackedObjects({ transport, token: '' }, objects, {})

    expect(transport).not.toHaveBeenCalled()
    expect(result.errors['*']).toBe('NO_TOKEN')
  })

  it('возвращает пустой результат без объектов', async () => {
    const transport = vi.fn()

    const result = await pollTrackedObjects({ transport, token: 'token' }, [], {})

    expect(result.commitsByObject).toEqual({})
    expect(transport).not.toHaveBeenCalled()
  })

  it('сообщает об отклонённом токене', async () => {
    const transport = vi.fn(async () => {
      throw new CsrfTokenRejectedError()
    })

    const result = await pollTrackedObjects({ transport, token: 'bad' }, objects, {})

    expect(result.tokenRejected).toBe(true)
  })

  it('сортирует новые коммиты по убыванию даты', async () => {
    const transport = vi.fn(async () =>
      parseBatchResponse(
        okResponse([
          [commit('1', '2026-11-01'), commit('3', '2026-11-03')],
          [commit('2', '2026-11-02')],
        ]),
      ),
    )

    const result = await pollTrackedObjects({ transport, token: 'token' }, objects, {
      '1': 'old',
      '2': 'old',
    })

    expect(result.newCommits.map((item) => item.id)).toEqual(['3', '2', '1'])
  })
})

describe('object_tracker: read marks', () => {
  it('ставит отметку на самый свежий коммит', () => {
    const marks = buildReadMarks(
      {
        '1': [commit('10', '2026-11-05'), commit('9', '2026-11-04')],
        '2': [],
      },
      { '2': 'old' },
    )

    expect(marks['1']).toBe('10')
    expect(marks['2']).toBe('old')
  })

  it('не теряет отметки объектов вне ответа', () => {
    const marks = buildReadMarks({}, { '5': 'x' })

    expect(marks['5']).toBe('x')
  })
})

describe('object_tracker: mergeCachedCommits', () => {
  it('перезаписывает кэш по объектам и сохраняет остальные', () => {
    const merged = mergeCachedCommits({ '1': [commit('1', '2026-11-01')] }, { '2': [] })

    expect(Object.keys(merged).sort()).toEqual(['1', '2'])
  })
})

describe('object_tracker: дотягивание данных объекта', () => {
  const withoutCategory: TrackedObject[] = [{ id: '7', title: '', addedAt: 0 }]

  it('запрашивает getGeoObject для объектов без категории', async () => {
    const transport = vi.fn(async () => [
      ...parseBatchResponse(okResponse([[]])),
      ...parseBatchResponse(
        JSON.stringify({
          data: [{ data: { geoObject: { title: 'Хутор', categoryId: 'ad_jc' } } }],
        }),
      ),
    ])

    const result = await pollTrackedObjects({ transport, token: 't' }, withoutCategory, {})

    expect(transport).toHaveBeenCalledTimes(1)
    expect(transport.mock.calls[0]?.[0]).toHaveLength(2)
    expect(transport.mock.calls[0]?.[0]?.[1]?.method).toBe('editor/getGeoObject')
    expect(result.enrichedObjects['7']).toEqual({ title: 'Хутор', categoryId: 'ad_jc' })
  })

  it('не запрашивает данные, если категория уже известна', async () => {
    const transport = vi.fn(async () => parseBatchResponse(okResponse([[]])))

    await pollTrackedObjects({ transport, token: 't' }, objects, {})

    expect(transport.mock.calls[0]?.[0]).toHaveLength(2)
    expect(
      transport.mock.calls[0]?.[0]?.every((call) => call.method === 'editor/getGeoObjectCommits'),
    ).toBe(true)
  })

  it('не добавляет объект в enrichment, если он не найден', async () => {
    const transport = vi.fn(async () => [
      ...parseBatchResponse(okResponse([[]])),
      ...parseBatchResponse(JSON.stringify({ data: [{ error: { type: 'ERR_MISSING_OBJECT' } }] })),
    ])

    const result = await pollTrackedObjects({ transport, token: 't' }, withoutCategory, {})

    expect(result.enrichedObjects).toEqual({})
  })
})
