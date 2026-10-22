import { parseStaticSvg } from '@/lib/parse_static_svg'
import { STATUS_FILTER_OPTIONS } from './constants'
import type { FeedStats, FeedStatusId } from './core'

export interface DropdownButtonElements {
  selectHost: HTMLSpanElement
  button: HTMLButtonElement
  buttonLabel: HTMLSpanElement
  buttonCount: HTMLSpanElement
  buttonIcon: HTMLSpanElement
}

/**
 * Создает DOM структуру селекта фильтра статусов Народной карты (кнопка, иконка, лейбл, счетчик).
 */
export const createDropdownButtonElements = (selectId: string): DropdownButtonElements => {
  const selectHost = document.createElement('span')
  selectHost.id = selectId
  selectHost.className =
    'nk-select nk-select_theme_islands nk-select_size_m nmap-feeds-status-select'

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'nk-button nk-button_theme_islands nk-button_size_m nk-select__button'
  button.setAttribute('aria-haspopup', 'listbox')
  button.setAttribute('aria-expanded', 'false')
  button.setAttribute('aria-label', 'Фильтр по статусу правок')

  const textSpan = document.createElement('span')
  textSpan.className = 'nk-button__text nk-select__text'

  const buttonIcon = document.createElement('span')
  buttonIcon.className = 'nk-icon'
  buttonIcon.style.display = 'none'
  buttonIcon.setAttribute('aria-hidden', 'true')
  textSpan.appendChild(buttonIcon)

  const buttonLabel = document.createElement('span')
  buttonLabel.textContent = 'Все статусы'
  textSpan.appendChild(buttonLabel)

  const buttonCount = document.createElement('span')
  buttonCount.className = 'nmap-status-count-badge'
  buttonCount.textContent = '0'
  textSpan.appendChild(buttonCount)

  button.appendChild(textSpan)

  const tickSpan = document.createElement('span')
  tickSpan.className = 'nk-select__tick'
  tickSpan.setAttribute('aria-hidden', 'true')
  button.appendChild(tickSpan)

  selectHost.appendChild(button)

  return {
    selectHost,
    button,
    buttonLabel,
    buttonCount,
    buttonIcon,
  }
}

/**
 * Обновляет иконку, лейбл и счетчик на кнопке фильтра в соответствии со статусом.
 */
export const updateDropdownButtonDisplay = (
  elements: Pick<DropdownButtonElements, 'buttonLabel' | 'buttonCount' | 'buttonIcon'>,
  status: FeedStatusId,
  latestStats: FeedStats,
): void => {
  const option = STATUS_FILTER_OPTIONS.find((opt) => opt.id === status)
  if (!option) {
    return
  }

  elements.buttonLabel.textContent = option.label

  if (option.iconClass && option.svgMarkup) {
    elements.buttonIcon.className = option.iconClass
    elements.buttonIcon.replaceChildren(parseStaticSvg(option.svgMarkup))
    elements.buttonIcon.style.display = 'inline-flex'
  } else {
    elements.buttonIcon.className = 'nk-icon'
    elements.buttonIcon.replaceChildren()
    elements.buttonIcon.style.display = 'none'
  }

  let countValue = latestStats.total
  if (status === 'published') countValue = latestStats.published
  else if (status === 'green') countValue = latestStats.green
  else if (status === 'yellow') countValue = latestStats.yellow
  else if (status === 'red') countValue = latestStats.red

  elements.buttonCount.textContent = String(countValue)
}
