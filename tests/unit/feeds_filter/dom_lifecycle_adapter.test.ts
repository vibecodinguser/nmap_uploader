// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FEED_HIDDEN_CLASS } from '@/lib/feeds_filter/constants'
import { FeedFilterDomAdapter } from '@/lib/feeds_filter/dom_lifecycle_adapter'

const buildFeedDom = (): HTMLElement => {
  const container = document.createElement('div')
  container.className = 'nk-user-feeds-view'

  const header = document.createElement('div')
  header.className = 'nk-user-feeds-view__header'
  const targetSelect = document.createElement('div')
  targetSelect.className = 'nk-select'
  const button = document.createElement('button')
  button.textContent = 'Правки'
  targetSelect.appendChild(button)
  header.appendChild(targetSelect)
  container.appendChild(header)

  const publishedCard = document.createElement('div')
  publishedCard.className = 'nk-event-view'
  publishedCard.innerHTML = `
    <span class="nk-date-time nk-event-view__date">1 час назад</span>
    <span class="nk-event-view__badge">Опубликована</span>
  `
  container.appendChild(publishedCard)

  const pendingCard = document.createElement('div')
  pendingCard.className = 'nk-event-view'
  pendingCard.innerHTML = `
    <span class="nk-date-time nk-event-view__date">2 часа назад</span>
    <span class="nk-event-view__badge">На рассмотрении</span>
  `
  container.appendChild(pendingCard)

  document.body.appendChild(container)
  return container
}

const findPeriodButton = (adapter: FeedFilterDomAdapter, label: string): HTMLButtonElement => {
  const buttons = adapter
    .getDropdownController()
    ?.popupElement.querySelectorAll<HTMLButtonElement>('.nmap-feeds-period-btn')
  const button = Array.from(buttons ?? []).find((item) => item.textContent === label)
  if (!button) throw new Error(`Не найдена кнопка периода «${label}»`)
  return button
}

const findStatusItem = (adapter: FeedFilterDomAdapter, status: string): HTMLElement => {
  const item = adapter
    .getDropdownController()
    ?.popupElement.querySelector<HTMLElement>(`[data-status="${status}"]`)
  if (!item) throw new Error(`Не найден пункт статуса «${status}»`)
  return item
}

describe('FeedFilterDomAdapter', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('применяет фильтр статуса сразу, не дожидаясь конца подгрузки', async () => {
    const container = buildFeedDom()
    const adapter = new FeedFilterDomAdapter()

    adapter.attachFilterToContainer(container, true)

    findPeriodButton(adapter, '3 дн.').click()
    expect(adapter.isFeedLoadingNow()).toBe(true)

    findStatusItem(adapter, 'published').click()

    // Лента реагирует сразу, подгрузка при этом продолжается.
    const [publishedCard, pendingCard] = Array.from(
      container.querySelectorAll<HTMLElement>('.nk-event-view'),
    )
    expect(publishedCard?.classList.contains(FEED_HIDDEN_CLASS)).toBe(false)
    expect(pendingCard?.classList.contains(FEED_HIDDEN_CLASS)).toBe(true)
    expect(adapter.isFeedLoadingNow()).toBe(true)

    await vi.advanceTimersByTimeAsync(12_000)

    expect(adapter.isFeedLoadingNow()).toBe(false)
    expect(pendingCard?.classList.contains(FEED_HIDDEN_CLASS)).toBe(true)

    adapter.removeFilterDropdown()
  })

  it('раскрывает скрытые карточки, когда из-за фильтра нечего прокручивать', async () => {
    const container = buildFeedDom()
    const adapter = new FeedFilterDomAdapter()

    adapter.attachFilterToContainer(container, true)

    // Прячем обе карточки: лента схлопывается, прокручивать нечего.
    findStatusItem(adapter, 'red').click()
    const cards = Array.from(container.querySelectorAll<HTMLElement>('.nk-event-view'))
    expect(cards.every((card) => card.classList.contains(FEED_HIDDEN_CLASS))).toBe(true)

    const hiddenDuringScroll: boolean[] = []
    const originalScrollIntoView = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function scrollIntoViewMock(this: Element) {
      const card = this.closest('.nk-event-view')
      if (card) {
        hiddenDuringScroll.push(card.classList.contains(FEED_HIDDEN_CLASS))
      }
    }

    try {
      findPeriodButton(adapter, '3 дн.').click()
      await vi.advanceTimersByTimeAsync(12_000)
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView
    }

    // На момент прокрутки карточки были раскрыты, а после загрузки фильтр вернулся.
    expect(hiddenDuringScroll.some((isHidden) => isHidden === false)).toBe(true)
    expect(cards.every((card) => card.classList.contains(FEED_HIDDEN_CLASS))).toBe(true)

    adapter.removeFilterDropdown()
  })

  it('не снимает фильтр, пока идёт подгрузка и DOM ленты временно не готов', async () => {
    const container = buildFeedDom()
    const adapter = new FeedFilterDomAdapter()

    adapter.attachFilterToContainer(container, true)
    findPeriodButton(adapter, '3 дн.').click()
    expect(adapter.isFeedLoadingNow()).toBe(true)

    // Режим переключился на «Все»: контейнер формально не готов.
    const targetButton = container.querySelector('button')
    if (targetButton) targetButton.textContent = 'Все'
    adapter.checkAndAttach(true)

    expect(adapter.getDropdownController()).not.toBeNull()
    expect(adapter.isFeedLoadingNow()).toBe(true)

    if (targetButton) targetButton.textContent = 'Правки'
    await vi.advanceTimersByTimeAsync(12_000)
    expect(adapter.isFeedLoadingNow()).toBe(false)

    adapter.removeFilterDropdown()
  })

  it('переносит фильтры в новую ленту, если старая осталась скрытой после Escape', () => {
    const adapter = new FeedFilterDomAdapter()

    const oldPanel = buildFeedDom()
    adapter.attachFilterToContainer(oldPanel, true)

    // Escape закрывает панель: сайт прячет старую ленту, но не удаляет её.
    oldPanel.style.display = 'none'

    // Повторное открытие создаёт новую ленту.
    const newPanel = buildFeedDom()
    adapter.checkAndAttach(true)

    const dropdown = document.getElementById('nmap-uploader-feeds-filter-select')
    expect(dropdown).not.toBeNull()
    expect(dropdown?.style.display).toBe('')
    expect(dropdown?.closest('.nk-user-feeds-view')).toBe(newPanel)
    expect(adapter.getActiveContainer()).toBe(newPanel)

    adapter.removeFilterDropdown()
  })

  it('возвращает фильтры в ту же ленту после повторного открытия', () => {
    const adapter = new FeedFilterDomAdapter()
    const container = buildFeedDom()

    adapter.attachFilterToContainer(container, true)
    container.style.display = 'none'
    adapter.checkAndAttach(true)

    container.style.display = ''
    adapter.checkAndAttach(true)

    const dropdown = document.getElementById('nmap-uploader-feeds-filter-select')
    expect(dropdown).not.toBeNull()
    expect(dropdown?.style.display).toBe('')
    expect(dropdown?.closest('.nk-user-feeds-view')).toBe(container)

    adapter.removeFilterDropdown()
  })
})
