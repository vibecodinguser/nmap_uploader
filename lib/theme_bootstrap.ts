import { browser } from 'wxt/browser'
import { applyBrowserThemeVars } from '@/lib/browser_theme'
import {
  getStoredExtensionThemeMode,
  getStoredThemeMode,
  normalizeThemeMode,
  resolveTheme,
  syncThemeLocalToExtensionStorage,
  THEME_STORAGE_KEY,
  type ThemeMode,
} from '@/lib/theme'

/**
 * Включает или выключает тёмную тему на элементе и его shadow host.
 *
 * Класс именно переключается, а не только добавляется: без снятия старого
 * класса панель оставалась тёмной после возврата к светлой теме.
 */
export const applyThemeTo = (themeTarget: HTMLElement, isDark: boolean): void => {
  themeTarget.classList.toggle('dark', isDark)
  applyBrowserThemeVars(themeTarget, isDark)

  const root = themeTarget.getRootNode()
  if (root instanceof ShadowRoot && root.host instanceof HTMLElement) {
    root.host.classList.toggle('dark', isDark)
    applyBrowserThemeVars(root.host, isDark)
  }
}

/** Применяет сохранённую тему к элементу и shadow host при первом mount. */
export const applyStoredDarkTheme = (themeTarget: HTMLElement): void => {
  applyThemeTo(themeTarget, resolveTheme(getStoredThemeMode()) === 'dark')

  void syncThemeLocalToExtensionStorage().catch((error: unknown) => {
    console.warn('[nmap_uploader] theme storage bootstrap failed:', error)
  })
}

const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)'

/**
 * Следит за сменой темы и сообщает, стала ли она тёмной.
 *
 * Тема приходит из трёх источников, и все три важны: выбор в боковой панели
 * (`storage.local`), тот же выбор в `localStorage` соседних страниц расширения
 * и системная тема при режиме «как в системе».
 *
 * Наблюдатель нужен именно потому, что страницы расширения живут долго: панель
 * заметок открыта в постоянно смонтированном iframe и при смене темы не
 * перезагружается, поэтому без подписки оставалась в старой теме.
 */
export const observeStoredTheme = (onChange: (isDark: boolean) => void): (() => void) => {
  let mode: ThemeMode = getStoredThemeMode()
  let active = true
  const mediaQuery = window.matchMedia(SYSTEM_DARK_QUERY)

  const emit = (): void => {
    if (!active) return
    onChange(resolveTheme(mode) === 'dark')
  }

  const handleStorageChange = (
    changes: Record<string, { newValue?: unknown }>,
    area: string,
  ): void => {
    if (area !== 'local' || !(THEME_STORAGE_KEY in changes)) return
    mode = normalizeThemeMode(changes[THEME_STORAGE_KEY]?.newValue)
    emit()
  }

  const handleLocalStorage = (event: StorageEvent): void => {
    if (event.key !== THEME_STORAGE_KEY) return
    mode = normalizeThemeMode(event.newValue)
    emit()
  }

  const handleSystemTheme = (): void => {
    if (mode === 'system') emit()
  }

  browser.storage.onChanged.addListener(handleStorageChange)
  window.addEventListener('storage', handleLocalStorage)
  mediaQuery.addEventListener('change', handleSystemTheme)

  // Тема могла смениться, пока страница была скрыта: сразу выравниваем.
  getStoredExtensionThemeMode()
    .then((stored) => {
      mode = stored
      emit()
    })
    .catch(() => {})

  return () => {
    active = false
    browser.storage.onChanged.removeListener(handleStorageChange)
    window.removeEventListener('storage', handleLocalStorage)
    mediaQuery.removeEventListener('change', handleSystemTheme)
  }
}
