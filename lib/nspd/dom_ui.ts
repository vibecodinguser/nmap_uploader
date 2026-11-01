/**
 * UI-компоненты для страницы nspd.gov.ru: всплывающие уведомления (тосты),
 * кнопки сохранения и плавающий виджет над картой.
 */

export const NSPD_ACTION_BUTTON_CLASS = 'nmap-nspd-upload-btn'
export const NSPD_TOAST_CONTAINER_ID = 'nmapNspdToastContainer'
export const NSPD_FLOATING_WIDGET_ID = 'nmapNspdFloatingWidget'

export type NspdToastType = 'success' | 'error' | 'info'

/** Показывает временное уведомление на странице НСПД. */
export const showNspdToast = (
  message: string,
  _type: NspdToastType = 'info',
  durationMs = 4000,
): void => {
  if (typeof document === 'undefined') return

  let container = document.getElementById(NSPD_TOAST_CONTAINER_ID)
  if (!container) {
    container = document.createElement('div')
    container.id = NSPD_TOAST_CONTAINER_ID
    document.body.appendChild(container)
  }

  const widget = document.getElementById(NSPD_FLOATING_WIDGET_ID)
  const widgetBottom = widget?.getBoundingClientRect().bottom ?? 0
  const topPx = widgetBottom > 0 ? Math.round(widgetBottom + 16) : 152

  container.style.cssText = `
    position: fixed !important;
    top: ${topPx}px !important;
    left: 50% !important;
    right: auto !important;
    transform: translateX(-50%) !important;
    z-index: 9999999 !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    gap: 10px !important;
    pointer-events: none !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  `

  const toast = document.createElement('div')
  const bg = '#d32f2f'
  toast.style.cssText = `
    background: ${bg} !important;
    color: #ffffff !important;
    padding: 12px 20px !important;
    border-radius: 8px !important;
    font-size: 14px !important;
    font-weight: 500 !important;
    box-shadow: 0 4px 14px rgba(0,0,0,0.3) !important;
    max-width: 380px !important;
    text-align: center !important;
    pointer-events: auto !important;
    transition: opacity 0.3s ease, transform 0.3s ease !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 8px !important;
  `
  toast.textContent = message
  container.appendChild(toast)

  setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transform = 'translateY(-10px)'
    setTimeout(() => toast.remove(), 300)
  }, durationMs)
}

/** Создает стилизованную кнопку «В Блокнот картографа». */
export const createNspdUploadButton = (onUpload: () => void): HTMLButtonElement => {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = NSPD_ACTION_BUTTON_CLASS
  btn.style.cssText = `
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 8px !important;
    padding: 8px 16px !important;
    margin: 8px 0 !important;
    background-color: #fc0 !important;
    color: #000000 !important;
    border: none !important;
    border-radius: 6px !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2) !important;
    transition: background-color 0.2s ease, transform 0.1s ease !important;
    z-index: 99999 !important;
    position: relative !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    line-height: 1.4 !important;
    visibility: visible !important;
    opacity: 1 !important;
  `
  btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
      <path d="M12 3v12m0-12-4 4m4-4 4 4M5 14v5h14v-5"/>
    </svg>
    <span style="font-weight:600;color:#000;">В Блокнот картографа</span>
  `

  btn.addEventListener('mouseenter', () => {
    btn.style.backgroundColor = '#f5b800'
  })
  btn.addEventListener('mouseleave', () => {
    btn.style.backgroundColor = '#fc0'
  })
  btn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    onUpload()
  })

  return btn
}

/** Отображает или обновляет плавающий виджет с кнопкой действия в верхней части экрана карты. */
export const updateFloatingWidget = (
  cadNum: string | null,
  onUpload: (cadNum: string | null, btn: HTMLButtonElement) => void,
): void => {
  if (typeof document === 'undefined' || !document.body) return

  let widget = document.getElementById(NSPD_FLOATING_WIDGET_ID)
  if (!widget) {
    widget = document.createElement('div')
    widget.id = NSPD_FLOATING_WIDGET_ID
    widget.style.cssText = `
      position: fixed !important;
      top: 80px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      z-index: 999999 !important;
      display: flex !important;
      align-items: center !important;
      gap: 10px !important;
      background: #ffffff !important;
      border: 2px solid #fc0 !important;
      border-radius: 8px !important;
      padding: 6px 14px !important;
      box-shadow: 0 4px 16px rgba(0,0,0,0.25) !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    `
    document.body.appendChild(widget)
  }

  const currentKey = cadNum ?? '__initial__'
  if (widget.dataset.activeCadNum === currentKey) return
  widget.dataset.activeCadNum = currentKey
  widget.style.display = 'flex'
  widget.innerHTML = ''

  if (cadNum) {
    const label = document.createElement('span')
    label.style.cssText =
      'font-size: 13px !important; font-weight: 600 !important; color: #111111 !important;'
    label.textContent = cadNum
    widget.appendChild(label)

    const uploadBtn = createNspdUploadButton(() => onUpload(cadNum, uploadBtn))
    uploadBtn.style.setProperty('margin', '0', 'important')
    uploadBtn.style.setProperty('padding', '6px 12px', 'important')
    uploadBtn.style.setProperty('font-size', '12px', 'important')
    widget.appendChild(uploadBtn)
  } else {
    const uploadBtn = createNspdUploadButton(() => onUpload(null, uploadBtn))
    uploadBtn.style.setProperty('margin', '0', 'important')
    uploadBtn.style.setProperty('padding', '6px 14px', 'important')
    uploadBtn.style.setProperty('font-size', '13px', 'important')
    widget.appendChild(uploadBtn)
  }
}
