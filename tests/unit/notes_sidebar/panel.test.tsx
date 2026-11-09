// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { LocaleProvider } from '@/hooks/useLocale'
import { OccupiedDatesProvider } from '@/hooks/useOccupiedDates'
import { NOTES_PICK_SOURCE } from '@/lib/notes_sidebar/core'
import { NotesCreatePanel } from '@/lib/notes_sidebar/ui'
import { NOTES_SIDEBAR_UPLOAD_ACTION } from '@/lib/notes_sidebar/upload_action'

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
      getMessage: vi.fn((key: string) => key),
    },
    runtime: {
      sendMessage: vi.fn(() => Promise.resolve({ ok: true })),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  },
}))

const renderPanel = () =>
  render(
    <LocaleProvider>
      <OccupiedDatesProvider isLoggedIn={false}>
        <NotesCreatePanel />
      </OccupiedDatesProvider>
    </LocaleProvider>,
  )

const getRuntimeListener = (): ((message: unknown) => void) => {
  const listener = vi.mocked(browser.runtime.onMessage.addListener).mock.calls.at(-1)?.[0]
  if (!listener) throw new Error('runtime listener is not registered')
  return listener as (message: unknown) => void
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(browser.storage.local.get as any).mockResolvedValue({
    notes_selected_date: '01-01-2025',
    locale: 'ru',
  })
  ;(browser.runtime.sendMessage as any).mockResolvedValue({ ok: true })
})

afterEach(() => {
  cleanup()
})

describe('NotesCreatePanel', () => {
  it('показывает три кнопки создания', async () => {
    renderPanel()

    expect(await screen.findByText('Точка')).toBeDefined()
    expect(screen.getByText('Линия')).toBeDefined()
    expect(screen.getByText('Полигон')).toBeDefined()
  })

  it('показывает поле даты и сохраняет выбранную дату', async () => {
    renderPanel()

    const dateInput = await screen.findByDisplayValue('01-01-2025')
    fireEvent.change(dateInput, { target: { value: '02-02-2025' } })

    expect(browser.storage.local.set).toHaveBeenCalledWith({
      notes_selected_date: '02-02-2025',
    })
    expect((dateInput as HTMLInputElement).value).toBe('02-02-2025')
  })

  it('запускает рисование с меткой источника', async () => {
    renderPanel()
    const pointButton = await screen.findByText('Точка')

    await waitFor(() => expect((pointButton as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(pointButton)

    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'startPointPicking',
      geomType: 'Point',
      source: NOTES_PICK_SOURCE,
    })
  })

  it('блокирует кнопки, пока дата не выбрана', async () => {
    ;(browser.storage.local.get as any).mockResolvedValue({ locale: 'ru' })
    renderPanel()

    const pointButton = await screen.findByText('Точка')
    expect((pointButton as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Выберите дату в блокноте')).toBeDefined()
  })

  it('игнорирует выбор координат без метки сайдбара', async () => {
    renderPanel()
    await screen.findByText('Точка')

    act(() => {
      getRuntimeListener()({
        action: 'pointPicked',
        coords: [[55.7, 37.6]],
        geomType: 'Point',
      })
    })

    expect(screen.queryByPlaceholderText('Название')).toBeNull()
  })

  it('возвращает кнопки, если рисование прервано без координат', async () => {
    renderPanel()
    const pointButton = await screen.findByText('Точка')
    await waitFor(() => expect((pointButton as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(pointButton)

    expect(await screen.findByText('Нарисуйте на карте...')).toBeDefined()

    act(() => {
      getRuntimeListener()({
        action: 'pointPicked',
        coords: [],
        geomType: 'Point',
        source: NOTES_PICK_SOURCE,
      })
    })

    await waitFor(() => expect((pointButton as HTMLButtonElement).disabled).toBe(false))
    expect(screen.queryByText('Нарисуйте на карте...')).toBeNull()
    expect(screen.queryByPlaceholderText('Название')).toBeNull()
  })

  it('отменяет рисование кнопкой «Отмена»', async () => {
    renderPanel()
    const pointButton = await screen.findByText('Точка')
    await waitFor(() => expect((pointButton as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(pointButton)

    fireEvent.click(await screen.findByRole('button', { name: 'Отмена' }))

    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'cancelPointPicking',
      source: NOTES_PICK_SOURCE,
    })
    await waitFor(() => expect((pointButton as HTMLButtonElement).disabled).toBe(false))
    expect(screen.queryByText('Нарисуйте на карте...')).toBeNull()
  })

  it('показывает форму после рисования и сохраняет заметку', async () => {
    renderPanel()
    const pointButton = await screen.findByText('Точка')
    await waitFor(() => expect((pointButton as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(pointButton)

    act(() => {
      getRuntimeListener()({
        action: 'pointPicked',
        coords: [[55.7, 37.6]],
        geomType: 'Point',
        source: NOTES_PICK_SOURCE,
      })
    })

    const nameInput = await screen.findByPlaceholderText('Название')
    fireEvent.change(nameInput, { target: { value: 'Дом' } })

    const saveButton = screen.getByRole('button', { name: 'Сохранить' })
    await waitFor(() => expect((saveButton as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(saveButton)

    await waitFor(() =>
      expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
        action: NOTES_SIDEBAR_UPLOAD_ACTION,
        note: {
          coords: [[37.6, 55.7]],
          geomType: 'Point',
          name: 'Дом',
          desc: '',
          date: '01-01-2025',
        },
      }),
    )

    expect(await screen.findByText('Заметка сохранена')).toBeDefined()
  })
})
