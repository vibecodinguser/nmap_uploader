import { FEEDS_FILTER_SELECT_ID } from './constants'
import { findFeedHeader, isEditsModeSelected, isValidTargetSelect } from './container_finder'
import { syncFilterDropdownHeight } from './dom_dropdown'

export * from './container_finder'

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
