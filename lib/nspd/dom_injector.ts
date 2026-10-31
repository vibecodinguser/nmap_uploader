/**
 * Внедрение кнопки сохранения в карточку объекта nspd.gov.ru и управление всплывающими уведомлениями.
 */
import { browser } from 'wxt/browser'
import {
  buildGeoJsonFromNspdObjects,
  CADASTRAL_NUMBER_REGEX,
  sanitizeCadastralFileName,
} from '@/lib/nspd/extractor'
import { nspdFeatureStore } from '@/lib/nspd/feature_store'
import { inspectAndStorePayload } from '@/lib/nspd/network_interceptor'

export const NSPD_ACTION_BUTTON_CLASS = 'nmap-nspd-upload-btn'
export const NSPD_TOAST_CONTAINER_ID = 'nmapNspdToastContainer'
export const NSPD_FLOATING_WIDGET_ID = 'nmapNspdFloatingWidget'

/** Показывает временное уведомление на странице НСПД. */
export const showNspdToast = (
  message: string,
  _type: 'success' | 'error' | 'info' = 'info',
  durationMs = 4000,
): void => {
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

/** Пытается запросить геометрию объекта у API НСПД по кадастровому номеру, если она еще не перехвачена. */
export const tryFetchNspdGeometry = async (cadNum: string): Promise<boolean> => {
  const cleanNum = cadNum.trim()
  const searchEndpoints = [
    `/api/geoportal/v2/search/features?query=${encodeURIComponent(cleanNum)}`,
    `/api/geoportal/v1/spatial-data/search?query=${encodeURIComponent(cleanNum)}`,
  ]

  for (const url of searchEndpoints) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!response.ok) continue
      const data = (await response.json()) as unknown
      const count = inspectAndStorePayload(data)
      if (count > 0) return true
    } catch {}
  }

  return false
}

/** Выполняет отправку полигонов в расширение и завершает работу с вкладкой. */
export const handleUploadNspdObjects = async (
  cadastralNumber: string | null,
  btn: HTMLButtonElement,
): Promise<void> => {
  const span = btn.querySelector('span')
  const originalText = span ? span.textContent : ''

  if (span) {
    span.textContent = 'Сохранение…'
  }
  btn.disabled = true

  try {
    let rawObjects = nspdFeatureStore.resolveObjectsForUpload(cadastralNumber)

    if (rawObjects.length === 0 && cadastralNumber) {
      // Попытка фонового дозапроса геометрии у API
      await tryFetchNspdGeometry(cadastralNumber)
      rawObjects = nspdFeatureStore.resolveObjectsForUpload(cadastralNumber)
    }

    if (rawObjects.length === 0) {
      showNspdToast(
        'Не удалось получить геометрию выделенного участка. Кликните по участку на карте повторно.',
        'error',
      )
      return
    }

    const { featureCollection, primaryName } = buildGeoJsonFromNspdObjects(
      rawObjects,
      cadastralNumber ?? undefined,
    )

    if (featureCollection.features.length === 0) {
      showNspdToast('Выделенный объект не содержит полигонов.', 'error')
      return
    }

    const safeName = sanitizeCadastralFileName(primaryName)
    const response = (await browser.runtime.sendMessage({
      action: 'UPLOAD_NSPD_GEOJSON',
      geojson: featureCollection,
      name: safeName,
    })) as { ok: boolean; error?: string } | undefined

    if (response?.ok) {
      showNspdToast(`Полигон ${primaryName} успешно сохранён в Блокнот!`, 'success', 2000)
      setTimeout(() => {
        void browser.runtime.sendMessage({ action: 'CLOSE_CURRENT_TAB' })
      }, 700)
    } else {
      const errorMsg =
        response?.error === 'NOT_AUTHENTICATED'
          ? 'Для сохранения в Блокнот картографа необходимо войти через Яндекс ID в расширении.'
          : (response?.error ?? 'Ошибка загрузки полигона')
      showNspdToast(errorMsg, 'error')
    }
  } catch (err: unknown) {
    console.error('[nmap_uploader] error uploading NSPD object:', err)
    showNspdToast('Не удалось отправить геометрию в Блокнот картографа', 'error')
  } finally {
    if (span && originalText) {
      span.textContent = originalText
    }
    btn.disabled = false
  }
}

/** Ищет листовые элементы DOM, содержащие кадастровый номер. */
export const findCadastralElements = (): Array<{ element: HTMLElement; cadNum: string }> => {
  const results: Array<{ element: HTMLElement; cadNum: string }> = []
  if (typeof document === 'undefined' || !document.body) return results

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null)
  let node: Node | null = walker.nextNode()

  while (node) {
    const text = node.textContent ?? ''
    const match = text.match(CADASTRAL_NUMBER_REGEX)
    if (match) {
      const parent = node.parentElement
      if (
        parent &&
        !parent.closest(`.${NSPD_ACTION_BUTTON_CLASS}`) &&
        !parent.closest(`#${NSPD_TOAST_CONTAINER_ID}`) &&
        !parent.closest(`#${NSPD_FLOATING_WIDGET_ID}`)
      ) {
        results.push({ element: parent, cadNum: match[0] })
      }
    }
    node = walker.nextNode()
  }

  return results
}

/** Отображает или обновляет плавающий виджет с кнопкой действия в правом верхнем углу карты. */
export const updateFloatingWidget = (cadNum: string | null): void => {
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
    label.style.cssText = `font-size: 13px !important; font-weight: 600 !important; color: #111111 !important;`
    label.textContent = cadNum
    widget.appendChild(label)

    const uploadBtn = createNspdUploadButton(() => handleUploadNspdObjects(cadNum, uploadBtn))
    uploadBtn.style.setProperty('margin', '0', 'important')
    uploadBtn.style.setProperty('padding', '6px 12px', 'important')
    uploadBtn.style.setProperty('font-size', '12px', 'important')
    widget.appendChild(uploadBtn)
  } else {
    const uploadBtn = createNspdUploadButton(() => {
      const recent = nspdFeatureStore.getRecent()
      if (recent.length > 0) {
        handleUploadNspdObjects(null, uploadBtn)
      } else {
        showNspdToast('Кликните по участку или объекту на карте для выбора контура', 'info')
      }
    })
    uploadBtn.style.setProperty('margin', '0', 'important')
    uploadBtn.style.setProperty('padding', '6px 14px', 'important')
    uploadBtn.style.setProperty('font-size', '13px', 'important')
    widget.appendChild(uploadBtn)
  }
}

/** Ищет карточки свойств объектов на странице НСПД и монтирует кнопку. */
export const scanAndMountNspdButtons = (): number => {
  let mounted = 0
  const items = findCadastralElements()

  if (items.length > 0) {
    const primary = items[0]
    updateFloatingWidget(primary.cadNum)
  }

  for (const { element, cadNum } of items) {
    const container = element.parentElement
    if (!container) continue

    const alreadyHasButton = container.querySelector(`.${NSPD_ACTION_BUTTON_CLASS}`)
    if (alreadyHasButton) continue

    const button = createNspdUploadButton(() => handleUploadNspdObjects(cadNum, button))
    element.insertAdjacentElement('afterend', button)
    mounted += 1
  }

  return mounted
}

/** Запускает наблюдатель DOM на странице nspd.gov.ru. */
export const startNspdDomObserver = (): (() => void) => {
  console.log('[nmap_uploader] NSPD DOM observer starting on', window.location.href)
  updateFloatingWidget(null)
  scanAndMountNspdButtons()

  const observer = new MutationObserver(() => {
    scanAndMountNspdButtons()
  })

  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })
  }

  return () => {
    observer.disconnect()
    document.getElementById(NSPD_FLOATING_WIDGET_ID)?.remove()
    document.getElementById(NSPD_TOAST_CONTAINER_ID)?.remove()
  }
}
