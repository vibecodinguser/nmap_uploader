/**
 * Поиск скроллируемых контейнеров и программная прокрутка для ленты правок.
 */

/**
 * Находит все потенциально скроллируемые контейнеры для ленты событий.
 */
export const getAllScrollableContainers = (feedContainer: HTMLElement): HTMLElement[] => {
  const containers = new Set<HTMLElement>()

  // 1. Сам feedContainer и все его предки
  let current: HTMLElement | null = feedContainer
  while (current && current !== document.documentElement) {
    containers.add(current)
    current = current.parentElement
  }

  // 2. Внутренние элементы со скроллом
  feedContainer
    .querySelectorAll<HTMLElement>(
      '.nk-scrollable, .nk-scrollable__content, [class*="scrollable"], .nk-list, .nk-sidebar-view__body',
    )
    .forEach((el) => {
      containers.add(el)
    })

  // 3. Родители карточек
  const cards = feedContainer.querySelectorAll<HTMLElement>('.nk-event-view, [class*="event-view"]')
  if (cards.length > 0) {
    const lastCard = cards[cards.length - 1]
    if (lastCard.parentElement) {
      containers.add(lastCard.parentElement)
      if (lastCard.parentElement.parentElement) {
        containers.add(lastCard.parentElement.parentElement)
      }
    }
  }

  // Фильтруем элементы, которые могут скроллиться
  const scrollable: HTMLElement[] = []
  for (const el of containers) {
    const style = typeof window !== 'undefined' ? window.getComputedStyle(el) : null
    const overflowY = style?.overflowY
    if (
      overflowY === 'auto' ||
      overflowY === 'scroll' ||
      el.scrollHeight > el.clientHeight ||
      el.classList.contains('nk-scrollable') ||
      el.classList.contains('nk-scrollable__content')
    ) {
      scrollable.push(el)
    }
  }

  if (scrollable.length === 0) {
    scrollable.push(feedContainer)
  }

  return scrollable
}

/**
 * Находит основной скроллируемый контейнер для ленты событий.
 */
export const findFeedScrollableContainer = (feedContainer: HTMLElement): HTMLElement => {
  // 1. Ищем элемент с явным scrollHeight > clientHeight и overflow auto/scroll
  const all = getAllScrollableContainers(feedContainer)
  const activeScroll = all.find(
    (el) =>
      el.scrollHeight > el.clientHeight &&
      typeof window !== 'undefined' &&
      (window.getComputedStyle(el).overflowY === 'auto' ||
        window.getComputedStyle(el).overflowY === 'scroll'),
  )
  if (activeScroll) {
    return activeScroll
  }

  // 2. Ищем внутренний .nk-scrollable или .nk-scrollable__content
  const scrollChild = feedContainer.querySelector<HTMLElement>(
    '.nk-scrollable, .nk-scrollable__content, [class*="scrollable"]',
  )
  if (scrollChild) {
    return scrollChild
  }

  return feedContainer
}

/**
 * Программно триггерит дозагрузку следующей порции событий ленты через прокрутку.
 */
export const triggerFeedScrollLoad = (feedContainer: HTMLElement): void => {
  // 1. Нативный скролл последней карточки в видимую зону
  const cards = feedContainer.querySelectorAll<HTMLElement>('.nk-event-view, [class*="event-view"]')
  if (cards.length > 0) {
    const lastCard = cards[cards.length - 1]
    try {
      if (typeof lastCard.scrollIntoView === 'function') {
        lastCard.scrollIntoView({ behavior: 'auto', block: 'end' })
      }
    } catch {
      // Игнорируем в средах без нативного scrollIntoView
    }
  }

  // 2. Прокрутка всех найденных скролл-контейнеров
  const targets = getAllScrollableContainers(feedContainer)
  for (const target of targets) {
    const maxScroll = Math.max(0, target.scrollHeight - target.clientHeight)
    if (maxScroll > 0) {
      target.scrollTop = Math.max(0, maxScroll - 30)
      target.dispatchEvent(new Event('scroll', { bubbles: true }))
      target.scrollTop = maxScroll
      target.dispatchEvent(new Event('scroll', { bubbles: true }))
    } else {
      target.scrollTop = target.scrollHeight
      target.dispatchEvent(new Event('scroll', { bubbles: true }))
    }

    try {
      if (typeof WheelEvent !== 'undefined') {
        const wheelEvt = new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaY: 600,
        })
        target.dispatchEvent(wheelEvt)
      }
    } catch {
      // Игнорируем в средах без WheelEvent
    }
  }

  // 3. Клик по кнопке "Показать еще" / "Загрузить еще" (если есть)
  const moreButton = feedContainer.querySelector<HTMLElement>(
    'button.nk-button, .nk-user-feeds-view__more, [class*="more-button"], [class*="load-more"]',
  )
  if (moreButton && /ещ[её]|дальше|больше|load\s*more/i.test(moreButton.textContent || '')) {
    moreButton.click()
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('scroll'))
  }
}
