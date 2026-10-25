// @vitest-environment happy-dom

import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createFeedDailyLoader,
  findFeedScrollableContainer,
  getAllScrollableContainers,
  triggerFeedScrollLoad,
} from '@/lib/feeds_filter/daily_loader'

describe('feeds_filter daily_loader and scroll_scanner', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  describe('findFeedScrollableContainer, getAllScrollableContainers and triggerFeedScrollLoad', () => {
    it('находит все потенциально скроллируемые контейнеры и находит скролл', () => {
      const container = document.createElement('div')
      container.className = 'nk-user-feeds-view'
      const innerScroll = document.createElement('div')
      innerScroll.className = 'nk-scrollable__content'
      container.appendChild(innerScroll)

      const all = getAllScrollableContainers(container)
      expect(all.length).toBeGreaterThan(0)
      expect(all).toContain(innerScroll)

      const scrollable = findFeedScrollableContainer(container)
      expect(scrollable).toBe(innerScroll)
    })

    it('прокручивает контейнеры и диспатчит событие scroll', () => {
      const container = document.createElement('div')
      let scrollFired = false
      container.addEventListener('scroll', () => {
        scrollFired = true
      })
      Object.defineProperty(container, 'scrollHeight', { value: 1000, writable: true })

      triggerFeedScrollLoad(container)
      expect(container.scrollTop).toBe(1000)
      expect(scrollFired).toBe(true)
    })

    it('нажимает кнопку "Показать еще" при ее наличии', () => {
      const container = document.createElement('div')
      const moreBtn = document.createElement('button')
      moreBtn.className = 'nk-button'
      moreBtn.textContent = 'Показать еще'
      let clicked = false
      moreBtn.addEventListener('click', () => {
        clicked = true
      })
      container.appendChild(moreBtn)

      triggerFeedScrollLoad(container)
      expect(clicked).toBe(true)
    })
  })

  describe('createFeedDailyLoader', () => {
    it('создает контроллер суточной пагинации и сразу завершает работу, если карточки уже старше 24 часов', async () => {
      const container = document.createElement('div')
      container.className = 'nk-user-feeds-view'

      // Создаем карточку старше 24 часов (вчера)
      const oldCard = document.createElement('div')
      oldCard.className = 'nk-event-view'
      oldCard.innerHTML = '<span class="nk-date-time nk-event-view__date">вчера, 18:00</span>'
      container.appendChild(oldCard)

      const loader = createFeedDailyLoader(container, { maxStepsPerDay: 5, stepDelayMs: 0 })

      await act(async () => {
        await new Promise((res) => setTimeout(res, 20))
      })

      expect(loader.isLoading()).toBe(false)
      expect(loader.getLoadedDaysCount()).toBe(1)
      loader.teardown()
    })

    it('начинает дозагрузку, если последняя карточка относится к сегодняшнему дню', () => {
      const container = document.createElement('div')
      container.className = 'nk-user-feeds-view'

      const recentCard = document.createElement('div')
      recentCard.className = 'nk-event-view'
      recentCard.innerHTML = '<span class="nk-date-time nk-event-view__date">1 час назад</span>'
      container.appendChild(recentCard)

      const loader = createFeedDailyLoader(container, { maxStepsPerDay: 5, stepDelayMs: 50 })
      expect(loader.isLoading()).toBe(true)
      loader.teardown()
    })

    it('корректно очищает слушатели и останавливает загрузку при вызове teardown', async () => {
      const container = document.createElement('div')
      container.className = 'nk-user-feeds-view'
      document.body.appendChild(container)

      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML = '<span class="nk-date-time nk-event-view__date">вчера, 10:00</span>'
      container.appendChild(card)

      const loader = createFeedDailyLoader(container, { stepDelayMs: 0 })

      loader.teardown()
      expect(loader.isLoading()).toBe(false)
    })

    it('позволяет остановить активную загрузку через stopLoading', async () => {
      const container = document.createElement('div')
      container.className = 'nk-user-feeds-view'
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML = '<span class="nk-date-time nk-event-view__date">5 минут назад</span>'
      container.appendChild(card)

      const loader = createFeedDailyLoader(container, { maxStepsPerDay: 50, stepDelayMs: 50 })
      expect(loader.isLoading()).toBe(true)

      loader.stopLoading()

      await act(async () => {
        await new Promise((res) => setTimeout(res, 60))
      })

      expect(loader.isLoading()).toBe(false)
      loader.teardown()
    })

    it('не увеличивает период загрузки при скролле контейнера пользователем', async () => {
      const container = document.createElement('div')
      container.className = 'nk-user-feeds-view'
      const oldCard = document.createElement('div')
      oldCard.className = 'nk-event-view'
      oldCard.innerHTML = '<span class="nk-date-time nk-event-view__date">вчера, 12:00</span>'
      container.appendChild(oldCard)

      const loader = createFeedDailyLoader(container, { initialDays: 1, stepDelayMs: 0 })

      await act(async () => {
        await new Promise((res) => setTimeout(res, 20))
      })

      expect(loader.getTargetDays()).toBe(1)
      expect(loader.getLoadedDaysCount()).toBe(1)

      // Имитируем скролл в самый низ
      container.scrollTop = 5000
      container.dispatchEvent(new Event('scroll'))

      await act(async () => {
        await new Promise((res) => setTimeout(res, 20))
      })

      // Период НЕ должен увеличиться автоматически
      expect(loader.getTargetDays()).toBe(1)
      expect(loader.isLoading()).toBe(false)
      loader.teardown()
    })
  })
})
