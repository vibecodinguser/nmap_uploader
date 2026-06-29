// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
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

  it('рендрит кнопки выбора типа фигуры и отправляет сообщение при клике', async () => {
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

    // Кнопки типов геометрии
    const pointBtn = await screen.findByText('Точка')
    expect(pointBtn).toBeDefined()
    expect(screen.getByText('Линия')).toBeDefined()
    expect(screen.getByText('Полигон')).toBeDefined()

    // Клик по кнопке "Точка"
    fireEvent.click(pointBtn)

    // Должно отправиться сообщение о начале выбора точки на карте
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'startPointPicking',
      geomType: 'Point',
    })
  })

  it('показывает форму сохранения после выбора координат на карте', async () => {
    // Подменим storage так, чтобы selectedDate было валидным
    ;(browser.storage.local.get as any).mockResolvedValue({
      notes_selected_date: '2025-01-01',
    })

    let runtimeMessageListener: any = null
    ;(browser.runtime.onMessage.addListener as any).mockImplementation((listener: any) => {
      runtimeMessageListener = listener
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
    await screen.findByText('Точка')

    // Эмулируем получение координат от content скрипта
    expect(runtimeMessageListener).not.toBeNull()
    if (runtimeMessageListener) {
      act(() => {
        runtimeMessageListener({
          action: 'pointPicked',
          coords: [[37.6173, 55.7558]],
        })
      })
    }

    // Форма сохранения должна появиться
    const saveBtn = await screen.findByText('Сохранить') as HTMLButtonElement
    expect(saveBtn).toBeDefined()
    // Кнопка сохранения заблокирована, пока не введено название
    expect(saveBtn.disabled).toBe(true)
  })

  it('корректно подтягивает дату из слоя трекеров', async () => {
    // Подменим sendMessage, чтобы он вернул дату в формате Яндекса
    ;(browser.runtime.sendMessage as any).mockResolvedValue({ date: 'дата 17.06.2026 г.' })
    // Storage вернет другую дату, чтобы убедиться, что приоритет у трекера
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

    // В дата-пикере должно быть 17-06-2026
    const dateInput = await screen.findByDisplayValue('17-06-2026')
    expect(dateInput).toBeDefined()
  })
})
