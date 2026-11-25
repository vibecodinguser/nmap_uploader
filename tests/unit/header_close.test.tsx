// @vitest-environment happy-dom

/**
 * Кнопка закрытия в шапке панели расширения.
 *
 * Панель живёт в iframe попапа внутри страницы карты, поэтому сама убрать себя
 * из DOM не может: она посылает `postMessage` родителю, а хост попапа убирает
 * узел. Тест проверяет именно это — что кнопка просит закрыть попап, а не
 * просто рисуется.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Header } from '@/components/Header'
import { LocaleProvider } from '@/hooks/useLocale'
import { CLOSE_SETTINGS_POPUP_ACTION } from '@/lib/settings_popup/protocol'
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

let posted: Array<Record<string, unknown>> = []

beforeEach(async () => {
  await resetBrowserMocks()
  posted = []
  vi.spyOn(window.parent, 'postMessage').mockImplementation(((message: Record<string, unknown>) => {
    posted.push(message)
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

  it('клик просит хост закрыть попап', () => {
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Закрыть панель' }))

    expect(posted.map((message) => message.action)).toContain(CLOSE_SETTINGS_POPUP_ACTION)
  })

  it('кнопка есть и у авторизованного пользователя', () => {
    renderHeader({ id: '1', login: 'tester' })

    expect(screen.getByRole('button', { name: 'Закрыть панель' })).toBeTruthy()
  })
})
