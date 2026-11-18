// @vitest-environment happy-dom

/**
 * Выбор иконки в свойствах заметки.
 *
 * Реестр встроенных иконок — данные, поэтому проверяем не картинки, а
 * контракт: выбор пишется в заметку, «без иконки» очищает, активная плитка
 * одна, и у всех видов фигур выбор доступен.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NoteProperties } from '@/components/notes_panel/NoteProperties'
import { LocaleProvider } from '@/hooks/useLocale'
import { BUILTIN_ICONS } from '@/lib/notes/icons'
import { createDefaultStyle } from '@/lib/notes/model/style_resolution'
import type { Note, NoteIcon } from '@/lib/notes/model/types'

const note = (overrides: Partial<Note> = {}): Note => ({
  id: 'note-1',
  kind: 'Point',
  name: 'Точка',
  description: '',
  date: '14-11-2026',
  icon: null,
  showLabel: false,
  style: createDefaultStyle('Point'),
  groupId: null,
  createdAt: '2026-11-14T10:00:00.000Z',
  updatedAt: '2026-11-14T10:00:00.000Z',
  ...overrides,
})

const renderProperties = (overrides: Partial<Note> = {}, onPatch = vi.fn()) => {
  render(
    <LocaleProvider>
      <NoteProperties
        note={note(overrides)}
        fallbackName="14.11.2026 Точка"
        onPatch={onPatch}
        onBack={vi.fn()}
        groups={[]}
        onMoveToGroup={() => {}}
      />
    </LocaleProvider>,
  )
  return onPatch
}

afterEach(() => {
  cleanup()
})

describe('сетка иконок', () => {
  it('сорок две плитки делятся на четырнадцать колонок — три ряда', () => {
    // Встроенных сорок одна, плюс «без иконки» — сорок две. Ровно столько,
    // чтобы уложиться в три ряда по четырнадцать без остатка и без прокрутки.
    const tiles = BUILTIN_ICONS.length + 1

    expect(tiles).toBe(42)
    expect(tiles % 14).toBe(0)
    expect(tiles / 14).toBe(3)
  })
})

describe('выбор иконки', () => {
  it('показывает все встроенные иконки и «без иконки»', () => {
    renderProperties()

    const choices = screen.getAllByRole('button', { pressed: false })
    expect(choices.length).toBeGreaterThanOrEqual(BUILTIN_ICONS.length)
    expect(screen.getByRole('button', { name: 'Без иконки' })).toBeTruthy()
  })

  it('пишет выбранную иконку в заметку', () => {
    const onPatch = renderProperties()

    fireEvent.click(screen.getByRole('button', { name: 'flag' }))

    const expected: NoteIcon = { kind: 'builtin', value: 'flag' }
    expect(onPatch).toHaveBeenCalledWith({ icon: expected })
  })

  it('«без иконки» очищает значение', () => {
    const onPatch = renderProperties({ icon: { kind: 'builtin', value: 'flag' } })

    fireEvent.click(screen.getByRole('button', { name: 'Без иконки' }))

    expect(onPatch).toHaveBeenCalledWith({ icon: null })
  })

  it('подсвечивает выбранную иконку', () => {
    renderProperties({ icon: { kind: 'builtin', value: 'hospital' } })

    expect(screen.getByRole('button', { name: 'hospital' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(screen.getByRole('button', { name: 'flag' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('без иконки активна плитка «без иконки»', () => {
    renderProperties()

    expect(screen.getByRole('button', { name: 'Без иконки' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
  })

  it('выбор доступен и у площадных фигур', () => {
    const onPatch = renderProperties({ kind: 'Polygon' })

    fireEvent.click(screen.getByRole('button', { name: 'trees' }))

    expect(onPatch).toHaveBeenCalledWith({ icon: { kind: 'builtin', value: 'trees' } })
  })
})
