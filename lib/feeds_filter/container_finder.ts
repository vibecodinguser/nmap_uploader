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

export * from './target_select_validator'
