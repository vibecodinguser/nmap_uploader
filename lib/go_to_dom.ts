import { GO_TO_POPUP_VISIBLE_CLASS } from '@/lib/go_to_styles'

export const runWhenAnyElementExists = (
  selectors: readonly string[],
  callback: (element: Element) => void,
): (() => void) => {
  let observer: MutationObserver | undefined

  const disconnect = (): void => {
    observer?.disconnect()
    observer = undefined
  }

  const run = (): boolean => {
    for (const selector of selectors) {
      const element = document.querySelector(selector)
      if (!element) continue
      disconnect()
      callback(element)
      return true
    }
    return false
  }

  if (run()) return disconnect

  observer = new MutationObserver(() => {
    run()
  })
  observer.observe(document, { childList: true, subtree: true })

  return disconnect
}

export const runWhenElementExists = (
  selector: string,
  callback: (element: Element) => void,
): (() => void) => {
  let observer: MutationObserver | undefined

  const disconnect = (): void => {
    observer?.disconnect()
    observer = undefined
  }

  const run = (): boolean => {
    const element = document.querySelector(selector)
    if (!element) return false
    disconnect()
    callback(element)
    return true
  }

  if (run()) return disconnect

  observer = new MutationObserver(() => {
    run()
  })
  observer.observe(document, { childList: true, subtree: true })

  return disconnect
}

export const isElementDescendantToOrEquals = (
  element: EventTarget | null,
  targetElementId: string,
): boolean => {
  if (!(element instanceof Element)) return false

  let current: Element | null = element
  while (current) {
    if (current.id === targetElementId) return true
    current = current.parentElement
  }
  return false
}

const TOOLTIP_ID = 'nmapUploaderGoToTooltip'

const TOOLTIP_HTML = `<div id="${TOOLTIP_ID}" class="nmap-uploader-popup nmap-uploader-popup--tooltip" role="tooltip"><div class="nmap-uploader-popup__content"></div></div>`

const getTooltipElement = (): HTMLElement | null => document.getElementById(TOOLTIP_ID)

const getTooltipContentElement = (): HTMLElement | null =>
  document.querySelector(`#${TOOLTIP_ID} > .nmap-uploader-popup__content`)

const ensureTooltipElement = (): HTMLElement => {
  const existing = getTooltipElement()
  if (existing) return existing

  document.body.insertAdjacentHTML('beforeend', TOOLTIP_HTML)
  return getTooltipElement() as HTMLElement
}

export const showGoToTooltip = (
  text: string,
  alignTo: Element,
  position: 'left' | 'right' | 'top' | 'bottom',
): void => {
  const tooltip = ensureTooltipElement()
  const content = getTooltipContentElement()
  if (!content) return

  content.textContent = text

  const gap = 5
  tooltip.classList.add(GO_TO_POPUP_VISIBLE_CLASS)
  const tooltipRect = tooltip.getBoundingClientRect()
  const alignRect = alignTo.getBoundingClientRect()

  let left = alignRect.left
  let top = alignRect.top

  switch (position) {
    case 'left':
      left = alignRect.left - gap - tooltipRect.width
      top = alignRect.top
      break
    case 'right':
      left = alignRect.right + gap
      top = alignRect.top
      break
    case 'top':
      left = alignRect.left
      top = alignRect.top - gap - tooltipRect.height
      break
    case 'bottom':
      left = alignRect.left
      top = alignRect.top + alignRect.height + gap
      break
    default:
      break
  }

  tooltip.style.left = `${left}px`
  tooltip.style.top = `${top}px`

  const box = tooltip.getBoundingClientRect()
  if (box.right > document.body.offsetWidth) {
    tooltip.style.left = `${box.left - (box.right - document.body.offsetWidth)}px`
  }
}

export const hideGoToTooltip = (): void => {
  const tooltip = getTooltipElement()
  const content = getTooltipContentElement()
  if (!tooltip || !content) return

  tooltip.classList.remove(GO_TO_POPUP_VISIBLE_CLASS)
  content.textContent = ''
}
