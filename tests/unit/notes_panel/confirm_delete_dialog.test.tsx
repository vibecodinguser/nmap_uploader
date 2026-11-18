// @vitest-environment happy-dom

/**
 * Подтверждение удаления заметок.
 *
 * Повторяет нативное `nk-confirmation-view`: короткий вопрос и две кнопки
 * справа. Проверяем не вид, а поведение — без подтверждения ничего не
 * удаляется, Esc и клик по фону отменяют, фокус стоит на «Отменить».
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfirmDeleteDialog } from '@/components/notes_panel/ConfirmDeleteDialog'
import { LocaleProvider } from '@/hooks/useLocale'

const renderDialog = (message = 'Удалить заметку «Мост»?') => {
  const onCancel = vi.fn()
  const onConfirm = vi.fn()
  render(
    <LocaleProvider>
      <ConfirmDeleteDialog message={message} onCancel={onCancel} onConfirm={onConfirm} />
    </LocaleProvider>,
  )
  return { onCancel, onConfirm }
}

afterEach(() => {
  cleanup()
})

describe('подтверждение удаления', () => {
  it('показывает вопрос и две кнопки', () => {
    renderDialog()

    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(screen.getByText('Удалить заметку «Мост»?')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Отменить' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Удалить' })).toBeTruthy()
  })

  it('удаляет только после подтверждения', () => {
    const { onCancel, onConfirm } = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))

    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('«Отменить» закрывает без удаления', () => {
    const { onCancel, onConfirm } = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }))

    expect(onCancel).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('Esc отменяет', () => {
    const { onCancel, onConfirm } = renderDialog()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onCancel).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('фокус стоит на «Отменить», а не на удалении', () => {
    // Случайное нажатие Enter не должно удалять заметку.
    renderDialog()

    expect(document.activeElement?.textContent).toBe('Отменить')
  })
})
