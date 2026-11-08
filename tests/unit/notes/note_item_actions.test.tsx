// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { NoteItemActions } from '@/components/NoteListItem'
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

const point: NotePoint = {
  id: 'pt1',
  name: 'Мост через реку',
  latitude: 55.7,
  longitude: 37.6,
  date: '08-11-2026',
  geomType: 'Point',
}

const renderActions = (isHidden = false) =>
  render(
    <LocaleProvider>
      <NoteItemActions
        p={point}
        isHidden={isHidden}
        isDeletingId={null}
        onToggleVisibility={() => {}}
        setEditingPointId={() => {}}
        setEditingName={() => {}}
        setEditingDesc={() => {}}
        handleDeleteNote={() => {}}
      />
    </LocaleProvider>,
  )

afterEach(() => {
  cleanup()
})

describe('NoteItemActions', () => {
  it('оформляет «Показать на карте» нативной иконкой center в общей палитре', () => {
    renderActions()

    const button = screen.getByRole('button', { name: 'Показать на карте' })
    const classes = button.className.split(' ')

    expect(classes).toEqual(
      expect.arrayContaining([
        'nk-icon',
        'nk-icon_id_center',
        'nk-icon_align_auto',
        'nk-icon_colored',
        'nk-icon_interactive',
      ]),
    )
    expect(button.querySelector('svg')).not.toBeNull()
  })

  it('оформляет «Ещё» нативной иконкой more в общей палитре', () => {
    renderActions()

    const button = screen.getByRole('button', { name: 'Ещё' })
    const classes = button.className.split(' ')

    expect(classes).toEqual(
      expect.arrayContaining([
        'nk-icon',
        'nk-icon_id_more',
        'nk-icon_align_auto',
        'nk-icon_colored',
        'nk-icon_interactive',
      ]),
    )
    expect(button.querySelector('svg')).not.toBeNull()
  })

  it('держит обе кнопки в одной палитре', () => {
    renderActions()

    const center = screen.getByRole('button', { name: 'Показать на карте' })
    const more = screen.getByRole('button', { name: 'Ещё' })

    expect(center.classList.contains('nk-icon_colored')).toBe(true)
    expect(more.classList.contains('nk-icon_colored')).toBe(true)
    expect(center.classList.contains('nk-icon_interactive')).toBe(
      more.classList.contains('nk-icon_interactive'),
    )
  })

  it('отправляет центрирование карты по клику', () => {
    renderActions()

    fireEvent.click(screen.getByRole('button', { name: 'Показать на карте' }))

    expect(browser.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'centerMap', latitude: 55.7, longitude: 37.6 }),
    )
  })

  it('открывает меню с редактированием и удалением', () => {
    renderActions()

    fireEvent.click(screen.getByRole('button', { name: 'Ещё' }))

    expect(screen.getByRole('button', { name: 'Редактировать' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Удалить' })).toBeDefined()
  })

  it('показывает кнопку скрытия объекта левее центрирования', () => {
    renderActions()

    const eye = screen.getByRole('button', { name: 'Скрыть объект' })
    const center = screen.getByRole('button', { name: 'Показать на карте' })

    expect(eye.compareDocumentPosition(center) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(eye.className).toContain('nk-icon_id_eye')
    expect(eye.className).toContain('nk-icon_colored')
  })

  it('переключает подпись и иконку у скрытого объекта', () => {
    renderActions(true)

    const eye = screen.getByRole('button', { name: 'Показать объект' })
    expect(eye.className).toContain('nk-icon_id_eye')
  })

  it('вызывает переключение видимости по клику на глаз', () => {
    const onToggleVisibility = vi.fn()
    render(
      <LocaleProvider>
        <NoteItemActions
          p={point}
          isHidden={false}
          isDeletingId={null}
          onToggleVisibility={onToggleVisibility}
          setEditingPointId={() => {}}
          setEditingName={() => {}}
          setEditingDesc={() => {}}
          handleDeleteNote={() => {}}
        />
      </LocaleProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Скрыть объект' }))

    expect(onToggleVisibility).toHaveBeenCalledWith('pt1')
  })
})
