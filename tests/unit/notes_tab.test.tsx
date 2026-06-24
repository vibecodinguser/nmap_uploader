// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { NotesTab } from '@/components/NotesTab'
import { LocaleProvider } from '@/hooks/useLocale'
import { OccupiedDatesProvider } from '@/hooks/useOccupiedDates'

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn(() => Promise.resolve({})),
        set: vi.fn(() => Promise.resolve()),
      },
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    i18n: {
      getUILanguage: vi.fn(() => 'ru'),
      getMessage: vi.fn((key) => key),
    },
    runtime: {
      sendMessage: vi.fn(() => Promise.resolve()),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  },
}))

describe('NotesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(browser.storage.local.get as any).mockResolvedValue({})
  })

  afterEach(() => {
    cleanup()
  })

  it('рендрит кнопки выбора типа фигуры и дизейблит отправку', async () => {
    render(
      <LocaleProvider>
        <OccupiedDatesProvider isLoggedIn={true}>
          <NotesTab
            isUploading={false}
            isLoggedIn={true}
            onRequireAuth={() => {}}
            onManualUpload={() => {}}
          />
        </OccupiedDatesProvider>
      </LocaleProvider>,
    )

    // Кнопки типов геометрии
    expect(await screen.findByText('Точка')).toBeDefined()
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
      <LocaleProvider>
        <OccupiedDatesProvider isLoggedIn={true}>
          <NotesTab
            isUploading={false}
            isLoggedIn={true}
            onRequireAuth={() => {}}
            onManualUpload={() => {}}
          />
        </OccupiedDatesProvider>
      </LocaleProvider>,
    )

    // Ждем загрузки стейта из storage
    await new Promise((resolve) => setTimeout(resolve, 0))

    const pointBtn = await screen.findByText('Точка')
    fireEvent.click(pointBtn)

    const submitBtn = screen.getByText('Добавить заметку') as HTMLButtonElement
    expect(submitBtn.disabled).toBe(false)
  })
})
