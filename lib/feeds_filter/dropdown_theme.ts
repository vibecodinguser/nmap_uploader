/**
 * Синхронизация высоты и цветов дропдауна со стилями интерфейса Народной карты.
 */
export const syncFilterDropdownHeight = (
  dropdownElement: HTMLElement,
  referenceSelect?: HTMLElement | null,
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

  if (target && typeof window !== 'undefined') {
    const targetButton =
      target.querySelector<HTMLElement>(
        'button.nk-select__button, button.nk-button, .nk-select__button',
      ) || target
    const targetComputed = window.getComputedStyle(targetButton)

    const color = targetComputed.color
    if (color) {
      dropdownElement.style.setProperty('--nmap-feeds-select-color', color)
      dropdownElement.style.setProperty('--nmap-feeds-popup-color', color)
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
      dropdownElement.style.setProperty(
        '--nmap-feeds-select-tick',
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='6'%3E%3Cpath fill='%23000' d='M10.3 0L5.5 4.7.7 0 0 .7 5.5 6 11 .7z'/%3E%3C/svg%3E\")",
      )
      dropdownElement.style.setProperty('--nmap-feeds-popup-bg', '#ffffff')
      dropdownElement.style.setProperty('--nmap-feeds-popup-color', '#000000')
      dropdownElement.style.setProperty('--nmap-feeds-popup-border', 'rgba(0, 0, 0, 0.15)')
      dropdownElement.style.setProperty('--nmap-feeds-popup-hover-bg', 'rgba(0, 0, 0, 0.05)')
      dropdownElement.style.setProperty('--nmap-feeds-popup-checked-bg', 'rgba(0, 0, 0, 0.08)')
      dropdownElement.style.setProperty('--nmap-feeds-badge-bg', 'rgba(0, 0, 0, 0.08)')
    }
  }

  return effectiveHeight
}
