// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NotesTab } from '@/components/NotesTab'
import { browser } from 'wxt/browser'

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
      },
    },
  },
}))

describe('NotesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(browser.storage.local.get as any).mockResolvedValue({})
  })

  it('рендрит кнопки выбора типа фигуры и дизейблит отправку', async () => {
    render(
      <NotesTab
        isUploading={false}
        isLoggedIn={true}
        onRequireAuth={() => {}}
        onManualUpload={() => {}}
      />
    )

    // Кнопки типов геометрии
    expect(screen.getByText('Точка')).toBeDefined()
    expect(screen.getByText('Линия')).toBeDefined()
    expect(screen.getByText('Полигон')).toBeDefined()

    // Изначально фигура не выбрана, кнопка заблокирована
    const submitBtn = screen.getByText('Добавить заметку') as HTMLButtonElement
    expect(submitBtn.disabled).toBe(true)
  })

  it('активирует кнопку после выбора типа фигуры', async () => {
    // Подменим storage так, чтобы selectedDate было валидным
    ;(browser.storage.local.get as any).mockResolvedValue({
      notes_selected_date: '2025-01-01',
    })

    render(
      <NotesTab
        isUploading={false}
        isLoggedIn={true}
        onRequireAuth={() => {}}
        onManualUpload={() => {}}
      />
    )

    // Ждем загрузки стейта из storage
    await new Promise(resolve => setTimeout(resolve, 0))

    const pointBtn = screen.getByText('Точка')
    fireEvent.click(pointBtn)

    const submitBtn = screen.getByText('Добавить заметку') as HTMLButtonElement
    expect(submitBtn.disabled).toBe(false)
  })
})
