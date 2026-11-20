// @vitest-environment happy-dom

/**
 * Кнопка закрытия в шапке панели расширения.
 *
 * Панель живёт в iframe внутри страницы карты, поэтому сама убрать себя из DOM
 * не может: она просит background передать сообщение на вкладку карты, а там
 * content script убирает контейнер. Тест проверяет именно это — что кнопка
 * отправляет нужное действие, а не просто рисуется.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { Header } from '@/components/Header'
import { LocaleProvider } from '@/hooks/useLocale'
import { CLOSE_PANEL_SIDEBAR_ACTION } from '@/lib/panel_sidebar_notify'
import { resetBrowserMocks } from '@/tests/setup/browser_mock'

const noop = () => {}

const renderHeader = (user: null | { id: string; login: string } = null) =>
  render(
    <LocaleProvider>
      <Header
        user={user as never}
        avatarDataUrl={null}
        isLoggingIn={false}
        onLogin={noop}
        onLogout={noop}
      />
    </LocaleProvider>,
  )

let sent: Array<Record<string, unknown>> = []

beforeEach(async () => {
  await resetBrowserMocks()
  sent = []
  vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(((
    message: Record<string, unknown>,
  ) => {
    sent.push(message)
    return Promise.resolve({ ok: true })
  }) as never)
})

afterEach(() => {
  cleanup()
})

describe('закрытие панели из шапки', () => {
  it('кнопка есть и подписана', () => {
    renderHeader()

    const button = screen.getByRole('button', { name: 'Закрыть панель' })
    expect(button).toBeTruthy()
    expect(button.getAttribute('title')).toBe('Закрыть панель')
  })

  it('стоит внутри header-container', () => {
    const { container } = renderHeader()

    expect(container.querySelector('.header-container .header-close-btn')).not.toBeNull()
  })

  it('клик отправляет действие закрытия сайдбара', () => {
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Закрыть панель' }))

    expect(sent.map((message) => message.action)).toContain(CLOSE_PANEL_SIDEBAR_ACTION)
  })

  it('кнопка есть и у авторизованного пользователя', () => {
    renderHeader({ id: '1', login: 'tester' })

    expect(screen.getByRole('button', { name: 'Закрыть панель' })).toBeTruthy()
  })
})
