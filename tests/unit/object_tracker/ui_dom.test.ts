// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ObjectCommit, TrackedObject } from '@/lib/object_tracker/types'
import {
  buildObjectHistoryUrl,
  createCommitRow,
  createObjectRow,
  describeObject,
  flattenCommits,
  formatCommitDate,
  renderPanel,
  type TrackerViewModel,
} from '@/lib/object_tracker/ui/dom'

const commit = (overrides: Partial<ObjectCommit> = {}): ObjectCommit => ({
  id: '1',
  objectId: '4465652155',
  date: '2026-11-05T11:22:11+03:00',
  action: 'object-modified',
  approveStatus: 'pending',
  state: 'draft',
  primary: true,
  author: { publicId: 'stylesvoboda', displayName: 'stylesvoboda' },
  summary: 'изменена геометрия',
  ...overrides,
})

const tracked: TrackedObject[] = [{ id: '4465652155', title: 'хутор Захаров', addedAt: 0 }]

describe('object_tracker: форматирование', () => {
  it('форматирует дату коммита', () => {
    const formatted = formatCommitDate('2026-11-05T11:22:11+03:00')

    expect(formatted).toContain('05.11.2026')
  })

  it('возвращает исходную строку на невалидной дате', () => {
    expect(formatCommitDate('не дата')).toBe('не дата')
  })

  it('строит ссылку на историю объекта', () => {
    expect(buildObjectHistoryUrl('123')).toBe(
      'https://n.maps.yandex.ru/#!/objects/123/history/commits',
    )
  })

  it('подписывает объект названием, а без него — id', () => {
    expect(describeObject({ id: '1', title: 'Хутор', addedAt: 0 })).toBe('Хутор')
    expect(describeObject({ id: '1', title: '', addedAt: 0 })).toBe('Объект 1')
    expect(describeObject({ id: '1', title: '1', addedAt: 0 })).toBe('Объект 1')
  })

  it('сортирует коммиты по убыванию даты', () => {
    const commits = flattenCommits({
      a: [commit({ id: '1', date: '2026-11-01T00:00:00Z' })],
      b: [commit({ id: '2', date: '2026-11-05T00:00:00Z' })],
    })

    expect(commits.map((item) => item.id)).toEqual(['2', '1'])
  })
})

describe('object_tracker: строки', () => {
  it('создаёт строку коммита со ссылкой и статусом', () => {
    const row = createCommitRow(commit(), 'хутор Захаров', true)

    expect(row.classList.contains('nmap-ot-commit_new')).toBe(true)
    expect(row.querySelector('.nmap-ot-status')?.textContent).toBe('На рассмотрении')
    expect(row.querySelector<HTMLAnchorElement>('.nmap-ot-commit__object')?.href).toContain(
      '/objects/4465652155/history/commits',
    )
    expect(row.textContent).toContain('Объект изменён')
    expect(row.textContent).toContain('изменена геометрия')
  })

  it('не помечает прочитанный коммит', () => {
    const row = createCommitRow(commit(), 'Объект', false)

    expect(row.classList.contains('nmap-ot-commit_new')).toBe(false)
    expect(row.querySelector('.nmap-ot-new-badge')).toBeNull()
  })

  it('создаёт строку объекта с кнопкой удаления', () => {
    const onRemove = vi.fn()
    const target = tracked[0]
    if (!target) throw new Error('нет тестового объекта')
    const row = createObjectRow(target, [commit()], onRemove)

    expect(row.textContent).toContain('хутор Захаров')
    row.querySelector<HTMLButtonElement>('.nmap-ot-object__remove')?.click()
    expect(onRemove).toHaveBeenCalledWith('4465652155')
  })
})

describe('object_tracker: renderPanel', () => {
  const baseView: TrackerViewModel = {
    mode: 'feed',
    objects: tracked,
    commitsByObject: { '4465652155': [commit()] },
    newCommitIds: new Set(['1']),
    errors: {},
    isLoading: false,
    hasToken: true,
    intervalMinutes: 30,
  }

  const callbacks = {
    onAddObject: vi.fn(),
    onRemoveObject: vi.fn(),
    onModeChange: vi.fn(),
    onRefresh: vi.fn(),
    onMarkAllRead: vi.fn(),
  }

  beforeEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('рисует шапку, переключатель режимов и ленту', () => {
    const container = document.createElement('div')

    renderPanel(container, baseView, callbacks)

    expect(container.textContent).toContain('Мои объекты (1)')
    expect(container.textContent).toContain('Лента событий')
    expect(container.querySelectorAll('.nmap-ot-commit')).toHaveLength(1)
  })

  it('показывает предупреждение без токена', () => {
    const container = document.createElement('div')

    renderPanel(container, { ...baseView, hasToken: false }, callbacks)

    expect(container.querySelector('.nmap-ot-warning')).not.toBeNull()
  })

  it('в режиме объектов показывает список и ошибку загрузки', () => {
    const container = document.createElement('div')

    renderPanel(
      container,
      { ...baseView, mode: 'objects', errors: { '4465652155': 'ERR_MISSING_OBJECT' } },
      callbacks,
    )

    expect(container.querySelectorAll('.nmap-ot-object')).toHaveLength(1)
    expect(container.textContent).toContain('Объект не найден')
  })

  it('показывает пустое состояние без объектов', () => {
    const container = document.createElement('div')

    renderPanel(container, { ...baseView, objects: [], commitsByObject: {} }, callbacks)

    expect(container.textContent).toContain('Добавьте id объекта')
  })

  it('валидирует id в форме добавления', () => {
    const container = document.createElement('div')
    renderPanel(container, { ...baseView, objects: [] }, callbacks)

    const form = container.querySelector<HTMLFormElement>('.nmap-ot-add')
    const input = container.querySelector<HTMLInputElement>(
      '.nmap-ot-add__field .nk-text-input__control',
    )
    if (input) input.value = 'abc'
    form?.dispatchEvent(new Event('submit', { cancelable: true }))

    expect(callbacks.onAddObject).not.toHaveBeenCalled()
    expect(container.querySelector('.nmap-ot-add__error')?.textContent).toContain('цифр')
  })

  it('передаёт корректный id в обработчик добавления', () => {
    const container = document.createElement('div')
    renderPanel(container, { ...baseView, objects: [] }, callbacks)

    const form = container.querySelector<HTMLFormElement>('.nmap-ot-add')
    const input = container.querySelector<HTMLInputElement>(
      '.nmap-ot-add__field .nk-text-input__control',
    )
    if (input) input.value = '12345'
    form?.dispatchEvent(new Event('submit', { cancelable: true }))

    expect(callbacks.onAddObject).toHaveBeenCalledWith('12345')
  })
})
