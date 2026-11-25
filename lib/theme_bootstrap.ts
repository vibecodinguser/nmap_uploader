import {
  getNativeThemeSnapshot,
  setNativeTheme,
  subscribeNativeTheme,
  type Theme,
} from '@/lib/theme'
import { NATIVE_THEME_MESSAGE, NATIVE_THEME_QUERY_PARAM } from '@/lib/theme_bridge'

/**
 * Включает или выключает тёмную тему на элементе и его shadow host.
 *
 * Класс именно переключается, а не только добавляется: без снятия старого
 * класса панель оставалась тёмной после возврата к светлой теме.
 */
export const applyThemeTo = (themeTarget: HTMLElement, isDark: boolean): void => {
  themeTarget.classList.toggle('dark', isDark)

  const root = themeTarget.getRootNode()
  if (root instanceof ShadowRoot && root.host instanceof HTMLElement) {
    root.host.classList.toggle('dark', isDark)
  }
}

const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark'

const readNativeThemeFromLocation = (): Theme | null => {
  const value = new URLSearchParams(window.location.search).get(NATIVE_THEME_QUERY_PARAM)
  return isTheme(value) ? value : null
}

/**
 * Принимает тему редактора внутри iframe.
 *
 * Начальное значение приходит в URL (его ставит хост при создании iframe), а
 * дальнейшие изменения — сообщением. Без этого панель не может узнать тему
 * редактора: у неё другой origin и свой DOM.
 */
export const initNativeThemeBridge = (): (() => void) => {
  const initialTheme = readNativeThemeFromLocation()
  if (initialTheme) setNativeTheme(initialTheme)

  const handleMessage = (event: MessageEvent): void => {
    if (event.source !== window.parent) return
    const data = event.data as { action?: unknown; theme?: unknown } | null | undefined
    if (data?.action !== NATIVE_THEME_MESSAGE || !isTheme(data.theme)) return
    setNativeTheme(data.theme)
  }

  window.addEventListener('message', handleMessage)
  return () => {
    window.removeEventListener('message', handleMessage)
  }
}

/**
 * Применяет тему редактора к элементу и подписывается на её смену.
 *
 * Страницы расширения живут долго: панель заметок смонтирована в постоянно
 * открытом iframe и при смене темы не перезагружается, поэтому без подписки
 * оставалась бы в прежней теме. Сначала тема применяется сразу, затем идёт за
 * сообщениями моста.
 */
export const observeTheme = (onChange: (isDark: boolean) => void): (() => void) => {
  const emit = (): void => {
    onChange(getNativeThemeSnapshot() === 'dark')
  }

  emit()
  return subscribeNativeTheme(emit)
}
