// @vitest-environment happy-dom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { NotesTab } from '@/components/NotesTab'
import { LocaleProvider } from '@/hooks/useLocale'
import { OccupiedDatesProvider } from '@/hooks/useOccupiedDates'
import { downloadIndexJson } from '@/lib/yandex/client'

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

vi.mock('@/lib/yandex/client', () => ({
  downloadIndexJson: vi.fn(),
  getStoredAuth: vi.fn(() => Promise.resolve({ token: 'token' })),
  uploadIndexJson: vi.fn(),
}))

const mockedDownloadIndexJson = vi.mocked(downloadIndexJson)

const renderNotesTab = () =>
  render(
    <LocaleProvider>
      <OccupiedDatesProvider isLoggedIn={true}>
        <NotesTab />
      </OccupiedDatesProvider>
    </LocaleProvider>,
  )

describe('NotesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(browser.storage.local.get as any).mockResolvedValue({})
    ;(browser.runtime.sendMessage as any).mockResolvedValue(undefined)
    mockedDownloadIndexJson.mockResolvedValue(null)
  })

  afterEach(() => {
    cleanup()
  })

  it('не рендерит кнопки создания: они вынесены в сайдбар', async () => {
    ;(browser.storage.local.get as any).mockResolvedValue({
      notes_selected_date: '01-01-2025',
    })

    renderNotesTab()

    await screen.findByDisplayValue('01-01-2025')
    expect(screen.queryByText('Точка')).toBeNull()
    expect(screen.queryByText('Линия')).toBeNull()
    expect(screen.queryByText('Полигон')).toBeNull()
    expect(browser.runtime.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'startPointPicking' }),
    )
  })

  it('корректно подтягивает дату из слоя трекеров', async () => {
    ;(browser.runtime.sendMessage as any).mockResolvedValue({ date: 'дата 17.06.2026 г.' })
    ;(browser.storage.local.get as any).mockResolvedValue({
      notes_selected_date: '01-01-2025',
    })

    renderNotesTab()

    const dateInput = await screen.findByDisplayValue('17-06-2026')
    expect(dateInput).toBeDefined()
  })

  it('автоматически отправляет все полигоны выбранной даты без ручного выбора', async () => {
    ;(browser.storage.local.get as any).mockResolvedValue({
      notes_selected_date: '01-01-2025',
    })
    mockedDownloadIndexJson.mockResolvedValue({
      points: {
        'polygon-one': { coords: [37.6, 55.7], desc: 'Полигон один' },
        'polygon-two': { coords: [38.6, 56.7], desc: 'Полигон два' },
        line: { coords: [37.8, 55.8], desc: 'Линия' },
      },
      paths: {
        'polygon-one': [
          [37.6, 55.7],
          [37.7, 55.7],
          [37.7, 55.8],
          [37.6, 55.7],
        ],
        'polygon-two': [
          [38.6, 56.7],
          [38.7, 56.7],
          [38.7, 56.8],
          [38.6, 56.7],
        ],
        line: [
          [37.8, 55.8],
          [37.9, 55.8],
        ],
      },
    })

    renderNotesTab()

    await waitFor(() =>
      expect(browser.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DRAW_MAP_OBJECTS',
          snapTargets: [
            expect.objectContaining({ id: 'polygon-one' }),
            expect.objectContaining({ id: 'polygon-two' }),
          ],
        }),
      ),
    )

    expect(screen.queryByRole('button', { pressed: false })).toBeNull()
  })
})
