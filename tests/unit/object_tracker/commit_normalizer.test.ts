import { describe, expect, it } from 'vitest'
import {
  describeAction,
  describeApproveStatus,
  describeEditNotes,
  normalizeAction,
  normalizeCommit,
  normalizeCommits,
} from '@/lib/object_tracker/commit_normalizer'

const rawCommit = {
  id: '530951820',
  date: '2026-11-05T11:22:11+03:00',
  action: 'object-modified',
  primary: true,
  primaryObjectId: '4465652155',
  approveStatus: 'pending',
  state: 'draft',
  editNotes: { modified: { geometry: {} } },
  user: { publicId: 'stylesvoboda', displayName: 'stylesvoboda' },
}

describe('object_tracker: normalizeAction', () => {
  it('распознаёт известные действия', () => {
    expect(normalizeAction('object-created')).toBe('object-created')
    expect(normalizeAction('object-deleted')).toBe('object-deleted')
    expect(normalizeAction('service')).toBe('service')
  })

  it('неизвестное действие помечает как unknown', () => {
    expect(normalizeAction('something-new')).toBe('unknown')
  })
})

describe('object_tracker: describeAction', () => {
  it('даёт русские подписи', () => {
    expect(describeAction('object-created')).toBe('Объект создан')
    expect(describeAction('object-deleted')).toBe('Объект удалён')
    expect(describeAction('object-modified')).toBe('Объект изменён')
    expect(describeAction('unknown')).toBe('Другое изменение')
  })
})

describe('object_tracker: describeApproveStatus', () => {
  it('переводит статусы модерации', () => {
    expect(describeApproveStatus('published')).toBe('Опубликована')
    expect(describeApproveStatus('pending')).toBe('На рассмотрении')
    expect(describeApproveStatus('rejected')).toBe('Не принята')
  })

  it('возвращает исходное значение для неизвестного статуса', () => {
    expect(describeApproveStatus('custom')).toBe('custom')
    expect(describeApproveStatus('')).toBe('Без статуса')
  })
})

describe('object_tracker: describeEditNotes', () => {
  it('видит изменение геометрии', () => {
    expect(describeEditNotes({ modified: { geometry: {} } })).toBe('изменена геометрия')
  })

  it('видит изменение связей', () => {
    expect(describeEditNotes({ modified: { relations: { masters: {} } } })).toBe('изменены связи')
  })

  it('видит создание объекта', () => {
    expect(describeEditNotes({ created: {} })).toBe('создан объект')
  })

  it('возвращает пустую строку для мусора', () => {
    expect(describeEditNotes(null)).toBe('')
    expect(describeEditNotes('строка')).toBe('')
    expect(describeEditNotes({})).toBe('')
  })
})

describe('object_tracker: normalizeCommit', () => {
  it('приводит сырой коммит к доменной модели', () => {
    const commit = normalizeCommit(rawCommit, 'fallback')

    expect(commit).toEqual({
      id: '530951820',
      objectId: '4465652155',
      date: '2026-11-05T11:22:11+03:00',
      action: 'object-modified',
      approveStatus: 'pending',
      state: 'draft',
      primary: true,
      author: { publicId: 'stylesvoboda', displayName: 'stylesvoboda' },
      summary: 'изменена геометрия',
    })
  })

  it('берёт objectId из fallback, если в коммите его нет', () => {
    const commit = normalizeCommit({ id: '1', date: '', action: 'service' }, '777')

    expect(commit?.objectId).toBe('777')
  })

  it('подставляет publicId вместо пустого displayName', () => {
    const commit = normalizeCommit({ id: '1', user: { publicId: 'user1', displayName: '' } }, '777')

    expect(commit?.author).toEqual({ publicId: 'user1', displayName: 'user1' })
  })

  it('возвращает null на запись без id', () => {
    expect(normalizeCommit({ date: '2026-01-01' }, '1')).toBeNull()
    expect(normalizeCommit(null, '1')).toBeNull()
    expect(normalizeCommit('строка', '1')).toBeNull()
  })
})

describe('object_tracker: normalizeCommits', () => {
  it('отбрасывает некорректные записи', () => {
    const commits = normalizeCommits([rawCommit, { без: 'id' }, null], '1')

    expect(commits).toHaveLength(1)
    expect(commits[0]?.id).toBe('530951820')
  })

  it('возвращает пустой массив для не-массива', () => {
    expect(normalizeCommits(undefined, '1')).toEqual([])
    expect(normalizeCommits({}, '1')).toEqual([])
  })
})
