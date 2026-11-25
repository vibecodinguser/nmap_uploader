import { getSystemTheme, type Theme } from '@/lib/theme'

const PAGE_SELECTOR = '.nk-page'
const DARK_CLASS = 'nk-page_color-scheme_dark'
const LIGHT_CLASS = 'nk-page_color-scheme_light'
const AUTO_CLASS = 'nk-page_color-scheme_auto'
const SCHEME_SELECTOR = `.${DARK_CLASS}, .${LIGHT_CLASS}, .${AUTO_CLASS}`

/**
 * Узел, на котором редактор держит класс темы.
 *
 * В явном режиме это элемент с `nk-page_color-scheme_dark` / `_light`; в
 * «как в системе» класса темы может не быть, и тогда нужен `.nk-page` — чтобы
 * поймать появление явного класса позже.
 */
const findThemeElement = (): Element | null =>
  document.querySelector(SCHEME_SELECTOR) ?? document.querySelector(PAGE_SELECTOR)

/**
 * Тема нативного редактора.
 *
 * Явные классы `nk-page_color-scheme_dark` / `_light` задаёт сам редактор. В
 * режиме «как в системе» он класс темы не ставит (или ставит `_auto`), поэтому
 * остаётся только `prefers-color-scheme`.
 */
export const readNativeTheme = (): Theme => {
  const element = findThemeElement()
  if (element?.classList.contains(DARK_CLASS)) return 'dark'
  if (element?.classList.contains(LIGHT_CLASS)) return 'light'
  return getSystemTheme()
}

/**
 * Следит за темой редактора и сообщает о каждом изменении.
 *
 * Наблюдатель нужен из-за iframe'ов расширения: они не видят DOM редактора и
 * получают тему только сообщением. Системная тема важна для режима «Авто»,
 * когда класс `_dark` / `_light` не выставлен.
 */
export const observeNativeTheme = (onChange: (theme: Theme) => void): (() => void) => {
  let active = true
  let page: Element | null = null
  let pageObserver: MutationObserver | null = null
  let waitingObserver: MutationObserver | null = null
  let lastTheme = readNativeTheme()

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

  const emit = (): void => {
    if (!active) return
    const nextTheme = readNativeTheme()
    if (nextTheme === lastTheme) return
    lastTheme = nextTheme
    onChange(nextTheme)
  }

  const attachPage = (): void => {
    if (!active) return
    const nextPage = findThemeElement()
    if (nextPage === page) return

    pageObserver?.disconnect()
    page = nextPage
    if (!page) return

    pageObserver = new MutationObserver(emit)
    pageObserver.observe(page, { attributes: true, attributeFilter: ['class'] })
    waitingObserver?.disconnect()
    waitingObserver = null
    emit()
  }

  const handleSystemThemeChange = (): void => {
    emit()
  }

  mediaQuery.addEventListener('change', handleSystemThemeChange)
  attachPage()

  // На `document_idle` React-дерево редактора может ещё не отрисоваться.
  if (!page) {
    waitingObserver = new MutationObserver(attachPage)
    waitingObserver.observe(document.documentElement, { childList: true, subtree: true })
  }

  onChange(lastTheme)

  return () => {
    active = false
    pageObserver?.disconnect()
    waitingObserver?.disconnect()
    mediaQuery.removeEventListener('change', handleSystemThemeChange)
  }
}
