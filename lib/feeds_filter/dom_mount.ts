import { FEEDS_FILTER_POPUP_ID, FEEDS_FILTER_SELECT_ID } from './constants'
import { syncFilterDropdownHeight } from './dom_dropdown'
import { findEventCards } from './page_adapter'

/**
 * Ищет элемент шапки или панели управления ленты событий строго внутри контейнера ленты.
 */
export const findFeedHeader = (container?: HTMLElement | null): HTMLElement | null => {
  const headerSelectors = [
    '.nk-user-feeds-view__header',
    '.nk-user-feed-view__header',
    '.nk-feeds-view__header',
    '.nk-feed-view__header',
    '.nk-feed-header-view',
    '[class*="user-feeds-view__header"]',
    '[class*="user-feed-view__header"]',
    '[class*="feeds-view__header"]',
    '[class*="feed-header"]',
    '.nk-user-feeds-view__controls',
    '[class*="user-feeds-view__controls"]',
    '.nk-sidebar-view__header',
    '[class*="sidebar-view__header"]',
    '.nk-header-view',
  ]

  if (container) {
    for (const selector of headerSelectors) {
      const inContainer = container.querySelector<HTMLElement>(selector)
      if (inContainer) {
        return inContainer
      }
    }
    for (const selector of headerSelectors) {
      if (container.matches(selector)) {
        return container
      }
    }
  }

  for (const selector of headerSelectors) {
    const found = document.querySelector<HTMLElement>(selector)
    if (found) {
      const sidebar = found.closest('.nk-sidebar-view')
      if (sidebar) {
        const hasFeed =
          sidebar.querySelector('.nk-event-view, [class*="event-view"], [class*="feed"]') !== null
        if (hasFeed) {
          return found
        }
      } else {
        return found
      }
    }
  }

  return null
}

/**
 * Проверяет, является ли кандидат допустимым целевым селектом Народной карты,
 * рядом с которым можно разместить дропдаун фильтра статусов.
 */
export const isValidTargetSelect = (
  candidate: Element | null,
  dropdownElement?: HTMLElement | null,
): candidate is HTMLElement => {
  if (!candidate || !(candidate instanceof HTMLElement)) {
    return false
  }

  // Не может быть собственным элементом фильтра или его попапом
  if (candidate.id === FEEDS_FILTER_SELECT_ID || candidate.id === FEEDS_FILTER_POPUP_ID) {
    return false
  }

  // Не может быть частью/потомком нашего фильтра статусов
  if (
    candidate.closest(
      `#${FEEDS_FILTER_SELECT_ID}, #${FEEDS_FILTER_POPUP_ID}, .nmap-feeds-status-select, .nmap-feeds-status-popup`,
    )
  ) {
    return false
  }

  // Не может быть тем же элементом, предком или потомком переданного dropdownElement
  if (
    dropdownElement &&
    (dropdownElement === candidate ||
      dropdownElement.contains(candidate) ||
      candidate.contains(dropdownElement))
  ) {
    return false
  }

  // Не должен находиться внутри тулбара редактора, панели пользователя или кнопок управления
  if (
    candidate.closest(
      '.nk-user-feeds-control-view, .nk-toolbar-view, [class*="toolbar-view"], [class*="user-bar-view"], button:not(.nk-select), [class*="control-view"]:not([class*="feed"])',
    )
  ) {
    return false
  }

  // Исключаем внутренние элементы БЭМ
  if (
    candidate.classList.contains('nk-select__button') ||
    candidate.classList.contains('nk-select__text') ||
    candidate.classList.contains('nk-select__tick') ||
    candidate.classList.contains('nk-select__menu')
  ) {
    return false
  }

  const classList = Array.from(candidate.classList)
  const isSelect =
    classList.some(
      (cls) => cls === 'nk-select' || cls.startsWith('nk-select_') || cls.includes('select'),
    ) && !classList.some((cls) => cls.startsWith('nk-select__'))

  return isSelect
}

/**
 * Проверяет, выбран ли в целевом селекте режим "Правки".
 */
export const isEditsModeSelected = (targetSelect?: HTMLElement | null): boolean => {
  if (!targetSelect || !(targetSelect instanceof HTMLElement)) {
    return false
  }

  if (
    targetSelect.id === FEEDS_FILTER_SELECT_ID ||
    targetSelect.classList.contains('nmap-feeds-status-select') ||
    targetSelect.closest(`#${FEEDS_FILTER_SELECT_ID}`)
  ) {
    return false
  }

  const textElement =
    targetSelect.querySelector<HTMLElement>('.nk-button__text, .nk-select__text') ||
    targetSelect.querySelector<HTMLElement>('button') ||
    targetSelect

  const rawText = (textElement.textContent || '').trim().toLowerCase()
  if (!rawText) {
    return false
  }

  return rawText.includes('правк') || rawText.includes('edit')
}

/**
 * Ищет целевой селект nk-select в интерфейсе Народной карты строго внутри контейнера ленты.
 */
export const findTargetSelect = (
  container?: HTMLElement | null,
  dropdownElement?: HTMLElement | null,
): HTMLElement | null => {
  const notMeSelector = `:not(#${FEEDS_FILTER_SELECT_ID}):not(.nmap-feeds-status-select)`

  const queryCandidateSelects = (root: ParentNode): HTMLElement[] => {
    const rawList = root.querySelectorAll<HTMLElement>(
      `.nk-select${notMeSelector}, [class*="nk-select"]${notMeSelector}`,
    )
    const valid: HTMLElement[] = []
    for (let i = 0; i < rawList.length; i++) {
      const candidate = rawList[i]
      if (isValidTargetSelect(candidate, dropdownElement)) {
        valid.push(candidate)
      }
    }
    return valid
  }

  const pickBestSelect = (candidates: HTMLElement[]): HTMLElement | null => {
    if (candidates.length === 0) {
      return null
    }
    const editsSelect = candidates.find((c) => isEditsModeSelected(c))
    if (editsSelect) {
      return editsSelect
    }
    return candidates[0]
  }

  // 1. Приоритетный поиск в шапке ленты
  const header = findFeedHeader(container)
  if (header) {
    const candidates = queryCandidateSelects(header)
    const best = pickBestSelect(candidates)
    if (best) {
      return best
    }
  }

  // 2. Поиск внутри переданного контейнера ленты
  if (container) {
    const candidates = queryCandidateSelects(container)
    const best = pickBestSelect(candidates)
    if (best) {
      return best
    }
  }

  // 3. Поиск внутри сайдбара ленты событий в документе
  const scopedRoots = document.querySelectorAll<HTMLElement>(
    '.nk-user-feeds-view, .nk-user-feed-view, .nk-feeds-view, .nk-feed-view, .nk-events-view, [class*="user-feeds-view"], [class*="user-feed-view"], .nk-sidebar-view',
  )
  for (let i = 0; i < scopedRoots.length; i++) {
    const root = scopedRoots[i]
    if (root.classList.contains('nk-sidebar-view')) {
      const hasFeed =
        root.querySelector('.nk-event-view, [class*="event-view"], [class*="feed"]') !== null
      if (!hasFeed) {
        continue
      }
    }
    const candidates = queryCandidateSelects(root)
    const best = pickBestSelect(candidates)
    if (best) {
      return best
    }
  }

  return null
}

/**
 * Размещает дропдаун фильтра статусов рядом с целевым селектом, когда выбран режим "Правки".
 */
export const attachFilterDropdownToDom = (
  dropdownElement: HTMLElement,
  container: HTMLElement,
): boolean => {
  if (!container || !dropdownElement) {
    return false
  }

  // Защита от ошибочного монтирования в кнопки или контролы тулбара редактора
  if (
    container.matches(
      '.nk-user-feeds-control-view, .nk-toolbar-view, [class*="toolbar"], button, [class*="btn"]',
    )
  ) {
    return false
  }

  const targetSelect = findTargetSelect(container, dropdownElement)

  // Наш дропдаун должен отображаться ТОЛЬКО тогда, когда в штатном селекте выбран пункт "Правки"
  if (!targetSelect || !isEditsModeSelected(targetSelect)) {
    if (dropdownElement.parentElement) {
      dropdownElement.style.display = 'none'
    }
    return false
  }

  // Защита от HierarchyRequestError
  if (
    targetSelect === dropdownElement ||
    dropdownElement.contains(targetSelect) ||
    targetSelect.contains(dropdownElement)
  ) {
    return false
  }

  dropdownElement.style.display = ''

  if (targetSelect.nextElementSibling !== dropdownElement) {
    try {
      targetSelect.insertAdjacentElement('afterend', dropdownElement)
    } catch (error) {
      console.warn(
        '[nmap-uploader] Ошибка при размещении селекта фильтра рядом с targetSelect:',
        error,
      )
      return false
    }
  }
  syncFilterDropdownHeight(dropdownElement, targetSelect)
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => {
      syncFilterDropdownHeight(dropdownElement, targetSelect)
    })
  }
  return true
}

/**
 * Находит корневой контейнер ленты правок/событий в DOM.
 */
export const findFeedContainer = (root: ParentNode = document): HTMLElement | null => {
  // 1. Поиск по наличию карточек событий и их общего предка
  const eventCards =
    root instanceof HTMLElement
      ? findEventCards(root)
      : Array.from(root.querySelectorAll<HTMLElement>('.nk-event-view'))
  const eventCard = eventCards[0]
  if (eventCard) {
    const parentContainer =
      eventCard.closest<HTMLElement>(
        '.nk-user-feeds-view, .nk-user-feed-view, .nk-feeds-view, .nk-feed-view, .nk-events-view, [class*="user-feed"], [class*="feeds-view"], [class*="events-view"]',
      ) ||
      eventCard.closest<HTMLElement>('.nk-sidebar-view') ||
      eventCard.parentElement

    if (
      parentContainer &&
      !parentContainer.matches(
        '.nk-user-feeds-control-view, .nk-toolbar-view, [class*="toolbar"], button',
      )
    ) {
      return parentContainer
    }
  }

  // 2. Поиск по классам представления ленты пользователя
  const knownView =
    root.querySelector<HTMLElement>('.nk-user-feeds-view') ||
    root.querySelector<HTMLElement>('.nk-user-feed-view') ||
    root.querySelector<HTMLElement>('.nk-feeds-view') ||
    root.querySelector<HTMLElement>('.nk-feed-view') ||
    root.querySelector<HTMLElement>('.nk-events-view') ||
    root.querySelector<HTMLElement>(
      '[class*="user-feeds-view"]:not([class*="control-view"]):not(button)',
    ) ||
    root.querySelector<HTMLElement>(
      '[class*="user-feed-view"]:not([class*="control-view"]):not(button)',
    ) ||
    root.querySelector<HTMLElement>(
      '[class*="feeds-view"]:not([class*="control-view"]):not(button)',
    )

  if (knownView) {
    return knownView
  }

  // 3. Поиск по открытому сайдбару с признаками ленты событий
  const sidebar = root.querySelector<HTMLElement>('.nk-sidebar-view')
  if (sidebar) {
    const hasFeed =
      sidebar.querySelector('.nk-event-view, [class*="event-view"], [class*="feed"]') !== null
    if (hasFeed) {
      return sidebar
    }
  }

  // 4. Проверяем, не является ли сам root элементом ленты
  if (
    root instanceof HTMLElement &&
    root.matches(
      '.nk-user-feeds-view, .nk-user-feed-view, .nk-feeds-view, .nk-feed-view, .nk-events-view, [class*="user-feed"], [class*="feeds-view"]',
    ) &&
    !root.matches('.nk-user-feeds-control-view, .nk-toolbar-view, [class*="control-view"], button')
  ) {
    return root
  }

  return null
}
