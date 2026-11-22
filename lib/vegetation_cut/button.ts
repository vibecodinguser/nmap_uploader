/**
 * Кнопка «Разрезать растительность» в нативном тулбаре инструментов карты.
 *
 * Кнопка одевается в нативные классы `nk-on-map-toolbar__item`, поэтому
 * наследует размер, тему и подсветку нажатия. Своей иконки ножниц у редактора
 * нет в общем наборе `nk-icon_id_*`, поэтому рисуем SVG сами.
 */

import { markNmapOwned, removeOwnedElementsById } from '@/lib/go_to/ownership'
import { parseStaticSvg } from '@/lib/parse_static_svg'

export const VEGETATION_CUT_BUTTON_ID = 'nmap-vegetation-cut-button'

export const VEGETATION_CUT_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="6" cy="6" r="3" stroke="currentColor" stroke-width="2"/><circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="2"/><path d="M8.1 8.1 20 20M8.1 15.9 20 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'

const BUTTON_CLASSES = [
  'nmap-uploader-vegetation-cut-btn',
  'nk-button',
  'nk-button_theme_air',
  'nk-button_size_xl',
  'nk-on-map-toolbar__item',
]

export const ON_MAP_TOOLBAR_SELECTOR = '.nk-on-map-toolbar'

/** Нативная кнопка разрезания: после неё встаёт наша. */
export const NATIVE_SPLIT_ICON_SELECTOR = '[class*="nk-icon_id_split"]'

export const findOnMapToolbar = (): HTMLElement | null =>
  document.querySelector<HTMLElement>(ON_MAP_TOOLBAR_SELECTOR)

export const createVegetationCutButton = (label: string): HTMLButtonElement => {
  const button = document.createElement('button')
  button.type = 'button'
  button.id = VEGETATION_CUT_BUTTON_ID
  button.className = BUTTON_CLASSES.join(' ')
  button.setAttribute('aria-label', label)
  button.setAttribute('aria-pressed', 'false')
  button.title = label

  const iconHost = document.createElement('span')
  iconHost.className = 'nk-icon nk-icon_align_auto nmap-uploader-vegetation-cut-icon'
  iconHost.appendChild(parseStaticSvg(VEGETATION_CUT_ICON_SVG))
  button.appendChild(iconHost)

  return markNmapOwned(button)
}

export const getVegetationCutButton = (): HTMLButtonElement | null => {
  const element = document.getElementById(VEGETATION_CUT_BUTTON_ID)
  return element instanceof HTMLButtonElement ? element : null
}

export const setVegetationCutButtonActive = (button: HTMLElement, active: boolean): void => {
  button.classList.toggle('nk-button_checked', active)
  button.setAttribute('aria-pressed', active ? 'true' : 'false')
}

/** Убирает кнопку и её возможный дубль. */
export const removeVegetationCutButton = (): void => {
  removeOwnedElementsById(VEGETATION_CUT_BUTTON_ID)
}

export type EnsureVegetationCutButtonOptions = {
  label: string
  onClick: (button: HTMLButtonElement) => void
}

/**
 * Ставит кнопку в тулбар, если её ещё нет.
 *
 * Тулбар перерисовывается редактором, поэтому вызывающий код повторяет
 * `ensureVegetationCutButton` по мутациям DOM. Обработчик вешается один раз на
 * конкретный узел, чтобы повторные вызовы не множили подписки.
 */
export const ensureVegetationCutButton = ({
  label,
  onClick,
}: EnsureVegetationCutButtonOptions): HTMLButtonElement | null => {
  const toolbar = findOnMapToolbar()
  if (!toolbar) return null

  const existing = getVegetationCutButton()
  if (existing && existing.parentElement === toolbar) {
    return existing
  }

  const button = existing ?? createVegetationCutButton(label)

  if (button.dataset.nmapVegetationCutBound !== 'true') {
    button.dataset.nmapVegetationCutBound = 'true'
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      onClick(button)
    })
  }

  const nativeSplit = toolbar.querySelector(NATIVE_SPLIT_ICON_SELECTOR)?.closest('button')
  if (nativeSplit && nativeSplit.parentElement === toolbar) {
    nativeSplit.insertAdjacentElement('afterend', button)
  } else {
    toolbar.appendChild(button)
  }

  return button
}
