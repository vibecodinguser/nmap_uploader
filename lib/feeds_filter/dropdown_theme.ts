/**
 * Синхронизация высоты и цветов дропдауна со стилями интерфейса Народной карты.
 *
 * Палитру попапа задаёт тема редактора (`injected_tokens.css`: `.nk-page_color-scheme_light`
 * и медиазапрос для `_auto`), поэтому здесь она НЕ переписывается. Раньше этот
 * код писал цвета по яркости текста нативной кнопки, но переменные назывались
 * иначе, чем те, что читает `feeds_popup.css`, — записи были мёртвыми.
 * Цвет текста селекта остаётся: его копирует сам селект, он не про попап.
 */
export const syncFilterDropdownHeight = (
  dropdownElement: HTMLElement,
  referenceSelect?: HTMLElement | null,
  popupElement?: HTMLElement | null,
): number => {
  const target = referenceSelect
  let measuredHeight = 0

  if (target) {
    const targetButton =
      target.querySelector<HTMLElement>(
        'button.nk-select__button, button.nk-button, .nk-select__button',
      ) || target
    const rect = targetButton.getBoundingClientRect()
    if (rect.height > 0) {
      measuredHeight = Math.round(rect.height)
    } else {
      const computed = window.getComputedStyle(targetButton)
      const parsed = Number.parseFloat(computed.height)
      if (!Number.isNaN(parsed) && parsed > 0) {
        measuredHeight = Math.round(parsed)
      } else if (targetButton.offsetHeight > 0) {
        measuredHeight = targetButton.offsetHeight
      }
    }
  }

  const effectiveHeight = measuredHeight > 0 ? measuredHeight : 32
  const heightPx = `${effectiveHeight}px`

  dropdownElement.style.setProperty('--nmap-feeds-select-height', heightPx)
  dropdownElement.style.height = heightPx
  dropdownElement.style.minHeight = heightPx

  const button = dropdownElement.querySelector<HTMLElement>('.nk-select__button')
  if (button) {
    button.style.height = heightPx
    button.style.minHeight = heightPx
    button.style.maxHeight = heightPx
  }

  const setProperty = (name: string, value: string) => {
    dropdownElement.style.setProperty(name, value)
    popupElement?.style.setProperty(name, value)
  }

  if (target && typeof window !== 'undefined') {
    const targetButton =
      target.querySelector<HTMLElement>(
        'button.nk-select__button, button.nk-button, .nk-select__button',
      ) || target
    const targetComputed = window.getComputedStyle(targetButton)

    const color = targetComputed.color
    if (color) {
      dropdownElement.style.setProperty('--nmap-feeds-select-color', color)
    }

    const borderRadius = targetComputed.borderRadius
    if (borderRadius && borderRadius !== '0px') {
      dropdownElement.style.setProperty('--nmap-feeds-select-radius', borderRadius)
    }

    const borderColor = targetComputed.borderColor
    const borderWidth = targetComputed.borderWidth
    const borderStyle = targetComputed.borderStyle
    if (
      borderColor &&
      borderWidth &&
      borderStyle &&
      borderStyle !== 'none' &&
      borderWidth !== '0px'
    ) {
      dropdownElement.style.setProperty(
        '--nmap-feeds-select-border',
        `${borderWidth} ${borderStyle} ${borderColor}`,
      )
    }

    const backgroundColor = targetComputed.backgroundColor
    if (backgroundColor) {
      dropdownElement.style.setProperty('--nmap-feeds-select-bg', backgroundColor)
    }

    const isLightText =
      color.includes('255, 255, 255') ||
      color.includes('rgba(255') ||
      color === 'rgb(255, 255, 255)' ||
      color === '#ffffff' ||
      color === '#ededed'

    if (!isLightText && color && color !== 'inherit') {
      setProperty(
        '--nmap-feeds-select-tick',
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='6'%3E%3Cpath fill='%23000' d='M10.3 0L5.5 4.7.7 0 0 .7 5.5 6 11 .7z'/%3E%3C/svg%3E\")",
      )
    } else if (isLightText) {
      setProperty(
        '--nmap-feeds-select-tick',
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='6'%3E%3Cpath fill='%23fff' d='M10.3 0L5.5 4.7.7 0 0 .7 5.5 6 11 .7z'/%3E%3C/svg%3E\")",
      )
    }
  }

  return effectiveHeight
}
