/**
 * Внедрение кнопки сохранения в карточку объекта nspd.gov.ru и управление жизненным циклом DOM.
 */
import { browser } from 'wxt/browser'
import {
  createNspdUploadButton,
  NSPD_ACTION_BUTTON_CLASS,
  NSPD_FLOATING_WIDGET_ID,
  NSPD_TOAST_CONTAINER_ID,
  updateFloatingWidget as renderFloatingWidget,
  showNspdToast,
} from '@/lib/nspd/dom_ui'
import {
  buildGeoJsonFromNspdObjects,
  CADASTRAL_NUMBER_REGEX,
  sanitizeCadastralFileName,
} from '@/lib/nspd/extractor'
import { nspdFeatureStore } from '@/lib/nspd/feature_store'
import { inspectAndStorePayload } from '@/lib/nspd/network_interceptor'

export {
  createNspdUploadButton,
  NSPD_ACTION_BUTTON_CLASS,
  NSPD_FLOATING_WIDGET_ID,
  NSPD_TOAST_CONTAINER_ID,
  showNspdToast,
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

/** Отображает или обновляет плавающий виджет с кнопкой действия. */
export const updateFloatingWidget = (cadNum: string | null): void => {
  renderFloatingWidget(cadNum, (num, btn) => {
    if (num) {
      void handleUploadNspdObjects(num, btn)
    } else {
      const recent = nspdFeatureStore.getRecent()
      if (recent.length > 0) {
        void handleUploadNspdObjects(null, btn)
      } else {
        showNspdToast('Кликните по участку или объекту на карте для выбора контура', 'info')
      }
    }
  })
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
