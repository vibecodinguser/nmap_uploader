// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NoteItemContent } from '@/components/NoteListItem'
import { LocaleProvider } from '@/hooks/useLocale'
import type { NotePoint } from '@/lib/notes'

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: { get: vi.fn(() => Promise.resolve({})), set: vi.fn(() => Promise.resolve()) },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    i18n: { getUILanguage: vi.fn(() => 'ru'), getMessage: vi.fn((key: string) => key) },
    runtime: {
      sendMessage: vi.fn(() => Promise.resolve()),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  },
}))

const basePoint: NotePoint = {
  id: 'pt1',
  name: 'Мост через реку',
  latitude: 55.7,
  longitude: 37.6,
  date: '08-11-2026',
  geomType: 'Point',
}

const renderContent = (point: NotePoint, isExpanded = false) =>
  render(
    <LocaleProvider>
      <NoteItemContent p={point} isExpanded={isExpanded} toggleExpand={() => {}} />
    </LocaleProvider>,
  )

afterEach(() => {
  cleanup()
})

describe('NoteItemContent', () => {
  it('не показывает шеврон, если описания нет', () => {
    const { container } = renderContent(basePoint)

    expect(container.querySelector('.notes-list-item-chevron')).toBeNull()
    expect(screen.getByText('Мост через реку')).toBeDefined()
  })

  it('не показывает шеврон для описания из пробелов', () => {
    const { container } = renderContent({ ...basePoint, noteDesc: '   ' })

    expect(container.querySelector('.notes-list-item-chevron')).toBeNull()
  })

  it('показывает шеврон и описание, когда описание есть', () => {
    const { container } = renderContent({ ...basePoint, noteDesc: 'Пешеходный' })

    expect(container.querySelector('.notes-list-item-chevron')).not.toBeNull()
    expect(screen.getByText('Пешеходный')).toBeDefined()
  })

  it('не даёт раскрыть заметку без описания', () => {
    renderContent(basePoint)

    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true)
  })

  it('поворачивает шеврон в раскрытом состоянии', () => {
    const { container } = renderContent({ ...basePoint, noteDesc: 'Пешеходный' }, true)

    expect(container.querySelector('.notes-list-item-chevron--expanded')).not.toBeNull()
  })
})
