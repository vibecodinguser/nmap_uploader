import { GO_TO_POPUP_VISIBLE_CLASS } from '@/lib/go_to_styles'
import { applyGoToTheme } from '@/lib/go_to_theme'

export const queryAllByDomId = (id: string): HTMLElement[] => {
  const elements = document.querySelectorAll<HTMLElement>(`[id="${id}"]`)
  return Array.from(elements)
}

const onElementExists = (
  selectors: readonly string[],
  callback: (element: Element) => void,
  observer: MutationObserver,
) => {
  let found = false
  for (const selector of selectors) {
    const element = document.querySelector(selector)
    if (element) {
      if (observer) {
        observer.disconnect()
      }
      callback(element)
      found = true
    }
  }
  return found
}

export const runWhenAnyElementExists = (
  selectors: readonly string[],
  callback: (element: Element) => void,
): (() => void) => {
  let observer: MutationObserver | undefined

  const disconnect = (): void => {
    if (observer) {
      observer.disconnect()
      observer = undefined
    }
  }

  const run = () => onElementExists(selectors, callback, observer!)

  if (!run()) {
    observer = new MutationObserver(run)
    observer.observe(document, { childList: true, subtree: true })
  }

  return disconnect
}

export const runWhenElementExists = (
  selector: string,
  callback: (element: Element) => void,
): (() => void) => {
  return runWhenAnyElementExists([selector], callback)
}

export const isElementDescendantToOrEquals = (
  element: EventTarget | null,
  targetElementId: string,
): boolean => {
  let isDescendant = false
  if (element instanceof Element) {
    let current: Element | null = element
    while (current && !isDescendant) {
      if (current.id === targetElementId) {
        isDescendant = true
      }
      current = current.parentElement
    }
  }
  return isDescendant
}

const TOOLTIP_ID = 'nmapUploaderGoToTooltip'

const getTooltipElement = (): HTMLElement | null => document.getElementById(TOOLTIP_ID)

const getTooltipContentElement = (): HTMLElement | null =>
  document.querySelector(`#${TOOLTIP_ID} > .nmap-uploader-popup__content`)

const createTooltipElement = (): HTMLElement => {
  const tooltip = document.createElement('div')
  tooltip.id = TOOLTIP_ID
  tooltip.className =
    'nk-popup nk-popup_theme_islands nk-popup_view_tooltip nmap-uploader-popup nmap-uploader-popup--tooltip'
  tooltip.setAttribute('role', 'tooltip')

  const content = document.createElement('div')
  content.className = 'nk-popup__content nmap-uploader-popup__content'
  tooltip.appendChild(content)

  return tooltip
}

const ensureTooltipElement = (): HTMLElement => {
  const existing = getTooltipElement()
  let tooltip: HTMLElement
  if (existing) {
    tooltip = existing
  } else {
    tooltip = createTooltipElement()
    document.documentElement.appendChild(tooltip)
  }
  return tooltip
}

export const showGoToTooltip = (
  text: string,
  alignTo: Element,
  position: 'left' | 'right' | 'top' | 'bottom',
): void => {
  const tooltip = ensureTooltipElement()
  applyGoToTheme(tooltip)
  const content = getTooltipContentElement()
  if (content) {
    content.textContent = text

    const gap = 5
    tooltip.classList.add('nk-popup_visible', GO_TO_POPUP_VISIBLE_CLASS)
    const tooltipRect = tooltip.getBoundingClientRect()
    const alignRect = alignTo.getBoundingClientRect()

    let left = alignRect.left
    let top = alignRect.top

    switch (position) {
      case 'left':
        left = alignRect.left - gap - tooltipRect.width
        top = alignRect.top + (alignRect.height - tooltipRect.height) / 2
        break
      case 'right':
        left = alignRect.right + gap
        top = alignRect.top + (alignRect.height - tooltipRect.height) / 2
        break
      case 'top':
        left = alignRect.left + (alignRect.width - tooltipRect.width) / 2
        top = alignRect.top - gap - tooltipRect.height
        break
      case 'bottom':
        left = alignRect.left + (alignRect.width - tooltipRect.width) / 2
        top = alignRect.top + alignRect.height + gap
        break
      default:
        break
    }

    const docWidth = document.documentElement.offsetWidth
    if (docWidth && left + tooltipRect.width > docWidth - 8) {
      left = Math.max(8, docWidth - tooltipRect.width - 8)
    }
    if (left < 8) {
      left = 8
    }

    tooltip.style.left = `${left}px`
    tooltip.style.top = `${top}px`
  }
}

export const hideGoToTooltip = (): void => {
  const tooltip = getTooltipElement()
  const content = getTooltipContentElement()
  if (tooltip && content) {
    tooltip.classList.remove('nk-popup_visible', GO_TO_POPUP_VISIBLE_CLASS)
    content.textContent = ''
  }
}
