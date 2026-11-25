// @vitest-environment happy-dom

/**
 * Шапка панели расширения: заголовок и закрытие.
 *
 * Панель живёт в iframe попапа внутри страницы карты, поэтому сама убрать себя
 * из DOM не может: она посылает `postMessage` родителю, а хост попапа убирает
 * узел. Тест проверяет именно это — что кнопка просит закрыть попап, а не
 * просто рисуется.
 *
 * Разметка повторяет нативную `.nk-sidebar-header-view`: заголовок по центру и
 * иконка закрытия справа. Нативные классы в тесте проверяются, потому что они
 * документируют паритет с редактором.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Header } from '@/components/Header'
import { LocaleProvider } from '@/hooks/useLocale'
import { CLOSE_SETTINGS_POPUP_ACTION } from '@/lib/settings_popup/protocol'
import { resetBrowserMocks } from '@/tests/setup/browser_mock'

const renderHeader = () =>
  render(
    <LocaleProvider>
      <Header />
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

describe('шапка панели', () => {
  it('повторяет нативную шапку боковой панели', () => {
    const { container } = renderHeader()

    const header = container.querySelector('header')
    expect(header?.classList.contains('nk-sidebar-header-view')).toBe(true)
    expect(header?.classList.contains('nk-grid')).toBe(true)
    expect(header?.classList.contains('nk-section_level_1')).toBe(true)
  })

  it('показывает заголовок «Настройки» по центру', () => {
    const { container } = renderHeader()

    const title = container.querySelector('.header-title')
    expect(title?.textContent).toBe('Настройки')
    expect(title?.classList.contains('nk-sidebar-header-view__title_centered')).toBe(true)
  })

  it('кнопка закрытия подписана и стоит в шапке', () => {
    const { container } = renderHeader()

    const button = screen.getByRole('button', { name: 'Закрыть панель' })
    expect(button.getAttribute('title')).toBe('Закрыть панель')
    expect(button.closest('header')).not.toBeNull()
    expect(button.classList.contains('nk-icon_id_close')).toBe(true)
    expect(container.querySelector('.header-close-btn')).toBe(button)
  })

  it('клик просит хост закрыть попап', () => {
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Закрыть панель' }))

    expect(posted.map((message) => message.action)).toContain(CLOSE_SETTINGS_POPUP_ACTION)
  })
})
