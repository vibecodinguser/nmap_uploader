/**
 * Кнопка входа в настройки — в правой части шапки редактора
 * (`.nk-app-bar-view`).
 *
 * Кнопка живёт среди нативных кнопок шапки и должна выглядеть как они:
 * `nk-button nk-button_theme_air nk-button_size_xl` без наших классов тулбара
 * карты, которые привязаны к нижнему блоку `.nk-map-region-view`.
 */
import { getOwnedElementById, markNmapOwned } from '@/lib/go_to/ownership'
import type { Locale } from '@/lib/i18n/locale.types'
import { createTranslator } from '@/lib/i18n/translate'
import { parseStaticSvg } from '@/lib/parse_static_svg'
import { SETTINGS_BUTTON_ICON_SVG } from './icon'
import { SETTINGS_BUTTON_ICON_REF, SETTINGS_BUTTON_ID } from './protocol'

/** Классы нативной кнопки шапки. */
export const SETTINGS_BUTTON_CLASS = 'nk-button nk-button_theme_air nk-button_size_xl'
/**
 * Своих модификаторов у кнопки нет, кроме отступа: нативные кнопки шапки
 * расходятся на 8px (`margin-left` их view-классов), а базовый `.nk-button`
 * задаёт `margin: 0` — без своего правила кнопка прилипает к соседней.
 */
export const SETTINGS_BUTTON_OWN_CLASS = 'yamapper-settings-button'

export const SETTINGS_APP_BAR_SELECTOR = '.nk-app-bar-view'

export type SettingsButtonOptions = {
  /** Язык подписи: кнопка живёт в интерфейсе редактора, не в панели. */
  locale: Locale
  onClick: () => void
}

export const getSettingsButton = (): HTMLButtonElement | null =>
  getOwnedElementById(SETTINGS_BUTTON_ID) as HTMLButtonElement | null

/** Шапка редактора; её может не быть в чужой раскладке или без прав записи. */
export const resolveSettingsAppBar = (): HTMLElement | null => {
  const bar = document.querySelector(SETTINGS_APP_BAR_SELECTOR)
  return bar instanceof HTMLElement ? bar : null
}

const bindClick = (button: HTMLButtonElement, onClick: () => void): void => {
  if (button.dataset.yamapperSettingsBound === 'true') {
    return
  }
  button.dataset.yamapperSettingsBound = 'true'
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    onClick()
  })
}

const resolveLabel = (locale: Locale): string => createTranslator(locale)(SETTINGS_BUTTON_ICON_REF)

const applyLabel = (button: HTMLButtonElement, locale: Locale): void => {
  const label = resolveLabel(locale)
  button.setAttribute('aria-label', label)
  button.title = label
}

export const createSettingsButton = ({
  locale,
  onClick,
}: SettingsButtonOptions): HTMLButtonElement => {
  const button = document.createElement('button')
  button.type = 'button'
  button.id = SETTINGS_BUTTON_ID
  button.className = `${SETTINGS_BUTTON_CLASS} ${SETTINGS_BUTTON_OWN_CLASS}`
  button.setAttribute('aria-expanded', 'false')
  applyLabel(button, locale)

  const iconHost = document.createElement('span')
  iconHost.className = 'nk-icon nk-icon_align_auto yamapper-settings-icon'
  iconHost.appendChild(parseStaticSvg(SETTINGS_BUTTON_ICON_SVG))
  button.appendChild(iconHost)

  bindClick(button, onClick)
  return markNmapOwned(button)
}

/**
 * Ставит кнопку последней в шапке.
 *
 * Последней, а не между нативными: вклинивание между «Создать» и кнопками
 * навигации читается как поломка интерфейса, а «справа» — это как раз край.
 * Если шапки нет, кнопку не создаём: вход остаётся у иконки расширения.
 */
export const ensureSettingsButton = ({
  locale,
  onClick,
}: SettingsButtonOptions): HTMLButtonElement | null => {
  const appBar = resolveSettingsAppBar()
  if (!appBar) {
    return null
  }

  const existing = getSettingsButton()
  if (existing) {
    if (existing.parentElement !== appBar) {
      appBar.appendChild(existing)
    }
    applyLabel(existing, locale)
    bindClick(existing, onClick)
    return existing
  }

  const button = createSettingsButton({ locale, onClick })
  appBar.appendChild(button)
  return button
}

/** Отмечает кнопку открытой/закрытой: `aria-expanded` и класс нажатия. */
export const syncSettingsButtonPressed = (pressed: boolean): void => {
  const button = getSettingsButton()
  button?.setAttribute('aria-expanded', pressed ? 'true' : 'false')
}

/** Восстанавливает иконку, если React-дерево редактора её вычистило. */
export const repairSettingsButtonIcon = (): void => {
  const button = getSettingsButton()
  const iconHost = button?.querySelector('.yamapper-settings-icon')
  if (!iconHost || iconHost.querySelector('svg')) {
    return
  }
  iconHost.replaceChildren(parseStaticSvg(SETTINGS_BUTTON_ICON_SVG))
}
