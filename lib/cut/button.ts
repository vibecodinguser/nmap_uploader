/**
 * Кнопка разреза в нативном тулбаре инструментов карты.
 *
 * Кнопка одевается в нативные классы `nk-on-map-toolbar__item`, поэтому
 * наследует размер, тему и подсветку нажатия. Своей иконки ножниц у редактора
 * нет в общем наборе `nk-icon_id_*`, поэтому рисуем SVG сами.
 *
 * У каждой цели разреза своя кнопка: своя id и своя подпись. Одновременно в
 * тулбаре видна только одна — по категории открытого объекта.
 */

import { markNmapOwned, removeOwnedElementsById } from '@/lib/go_to/ownership'
import { parseStaticSvg } from '@/lib/parse_static_svg'
import type { CutTarget } from './targets'

/**
 * Нативная иконка разрезания из набора редактора (модуль `1753` в
 * `app-bundle`: `nk-icon_id_split`). Берём её как есть, чтобы кнопка выглядела
 * так же, как нативная: залитый путь 22×22, цвет наследуется от `nk-icon`
 * (`fill: currentColor`).
 */
export const CUT_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><path d="m3.7 14.5 1.3 1 7.8-3.5 1.4.7 3.3.4c.6.3.3 1.2.3 1.2-.4.6-1 .6-1.6.4-.5-.2-.8-1.8-.8-1.8l-1.2-.2c.1.1.7 2.5 1.2 2.8.6.4 2.3.7 3.3-.2.9-.9.7-2.3-.7-2.9L14.9 11 18 9.7c1.4-.7 1.6-2 .7-3-1-.9-2.7-.5-3.3-.2-.5.4-1.2 2.8-1.2 2.8l1.2-.2s.3-1.5.9-1.8c.5-.2 1.1-.1 1.5.5 0-.1.3.8-.3 1.1l-3.3.4-1.4.7L5 6.6l-1.3 1 7.1 3.4-7.1 3.45z"/></svg>'

const BUTTON_CLASSES = [
  'yamapper-cut-btn',
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

export const createCutButton = (target: CutTarget, label: string): HTMLButtonElement => {
  const button = document.createElement('button')
  button.type = 'button'
  button.id = target.buttonId
  button.className = BUTTON_CLASSES.join(' ')
  button.setAttribute('aria-label', label)
  button.setAttribute('aria-pressed', 'false')
  button.title = label

  const iconHost = document.createElement('span')
  iconHost.className = 'nk-icon nk-icon_align_auto yamapper-cut-icon'
  iconHost.appendChild(parseStaticSvg(CUT_ICON_SVG))
  button.appendChild(iconHost)

  return markNmapOwned(button)
}

export const getCutButton = (target: CutTarget): HTMLButtonElement | null => {
  const element = document.getElementById(target.buttonId)
  return element instanceof HTMLButtonElement ? element : null
}

export const setCutButtonActive = (button: HTMLElement, active: boolean): void => {
  button.classList.toggle('nk-button_checked', active)
  button.setAttribute('aria-pressed', active ? 'true' : 'false')
}

/** Убирает кнопку цели и её возможный дубль. */
export const removeCutButton = (target: CutTarget): void => {
  removeOwnedElementsById(target.buttonId)
}

/** Убирает кнопки всех целей: при закрытии редактора цель может быть любой. */
export const removeAllCutButtons = (targets: readonly CutTarget[]): void => {
  for (const target of targets) removeCutButton(target)
}

export type EnsureCutButtonOptions = {
  target: CutTarget
  label: string
  onClick: (button: HTMLButtonElement) => void
}

/**
 * Ставит кнопку в тулбар, если её ещё нет.
 *
 * Тулбар перерисовывается редактором, поэтому вызывающий код повторяет
 * `ensureCutButton` по мутациям DOM. Обработчик вешается один раз на
 * конкретный узел, чтобы повторные вызовы не множили подписки.
 */
export const ensureCutButton = ({
  target,
  label,
  onClick,
}: EnsureCutButtonOptions): HTMLButtonElement | null => {
  const toolbar = findOnMapToolbar()
  if (!toolbar) return null

  const existing = getCutButton(target)
  if (existing && existing.parentElement === toolbar) {
    return existing
  }

  const button = existing ?? createCutButton(target, label)

  if (button.dataset.nmapCutBound !== 'true') {
    button.dataset.nmapCutBound = 'true'
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
