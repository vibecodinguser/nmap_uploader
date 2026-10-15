import { browser } from 'wxt/browser'
import { defineContentScript } from 'wxt/utils/define-content-script'
import {
  applyFeedFilter,
  attachFilterDropdownToDom,
  createFilterDropdownElement,
  ensureFeedFilterStyles,
  FEEDS_FILTER_ENABLED_STORAGE_KEY,
  FEEDS_FILTER_POPUP_ID,
  FEEDS_FILTER_SELECT_ID,
  type FeedStatusId,
  type FilterDropdownController,
  findFeedContainer,
  getStoredFeedsFilterEnabled,
} from '@/lib/user_feeds_filter'

export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_idle',

  main(ctx) {
    let isFeatureEnabled = true
    let currentFilter: FeedStatusId = 'all'
    let currentObserver: MutationObserver | null = null
    let activeFeedContainer: HTMLElement | null = null
    let currentDropdownController: FilterDropdownController | null = null

    ensureFeedFilterStyles()

    const handleDisconnectFeedObserver = () => {
      if (currentObserver) {
        currentObserver.disconnect()
        currentObserver = null
      }
      activeFeedContainer = null
    }

    const handleRemoveFilterDropdown = () => {
      handleDisconnectFeedObserver()

      if (currentDropdownController) {
        currentDropdownController.teardown()
        currentDropdownController = null
      }

      const existingSelect = document.getElementById(FEEDS_FILTER_SELECT_ID)
      if (existingSelect) {
        existingSelect.remove()
      }

      const existingPopup = document.getElementById(FEEDS_FILTER_POPUP_ID)
      if (existingPopup) {
        existingPopup.remove()
      }

      // Возвращаем видимость всем ранее скрытым карточкам
      const hiddenCards = document.querySelectorAll('.nmap-uploader-feed-event-hidden')
      hiddenCards.forEach((card) => {
        card.classList.remove('nmap-uploader-feed-event-hidden')
      })
    }

    const handleAttachFilterToContainer = (feedContainer: HTMLElement) => {
      if (!isFeatureEnabled) {
        return
      }

      activeFeedContainer = feedContainer

      // Если контроллер еще не создан, инициализируем его
      if (!currentDropdownController) {
        currentDropdownController = createFilterDropdownElement((selectedStatus) => {
          currentFilter = selectedStatus
          if (activeFeedContainer) {
            const stats = applyFeedFilter(activeFeedContainer, currentFilter)
            currentDropdownController?.updateCounters(stats)
          }
        }, currentFilter)
      }

      // Размещаем дропдаун рядом с целевым селектом nk-select
      attachFilterDropdownToDom(currentDropdownController.element, feedContainer)

      // Применяем фильтр к уже существующим карточкам
      const initialStats = applyFeedFilter(feedContainer, currentFilter)
      currentDropdownController.updateCounters(initialStats)

      // Отслеживаем динамическую подгрузку элементов при скролле (infinite scroll)
      handleDisconnectFeedObserver()
      activeFeedContainer = feedContainer

      currentObserver = new MutationObserver((mutations) => {
        let hasNewEventCards = false
        let shouldCheckPlacement = false

        for (const mutation of mutations) {
          if (mutation.addedNodes.length === 0) {
            continue
          }

          for (const node of mutation.addedNodes) {
            if (node instanceof HTMLElement) {
              if (
                node.id === FEEDS_FILTER_SELECT_ID ||
                node.id === FEEDS_FILTER_POPUP_ID ||
                node.closest(`#${FEEDS_FILTER_SELECT_ID}`)
              ) {
                continue
              }

              if (
                node.matches('.nk-select_theme_islands, [class*="select_theme_islands"]') ||
                node.querySelector('.nk-select_theme_islands, [class*="select_theme_islands"]')
              ) {
                shouldCheckPlacement = true
              }

              if (
                node.matches('.nk-event-view, [class*="event-view"]') ||
                node.querySelector('.nk-event-view, [class*="event-view"]')
              ) {
                hasNewEventCards = true
              }
            }
          }
        }

        if (shouldCheckPlacement && currentDropdownController && activeFeedContainer) {
          attachFilterDropdownToDom(currentDropdownController.element, activeFeedContainer)
        }

        if (hasNewEventCards && activeFeedContainer && currentDropdownController) {
          const stats = applyFeedFilter(activeFeedContainer, currentFilter)
          currentDropdownController.updateCounters(stats)
        }
      })

      currentObserver.observe(feedContainer, {
        childList: true,
        subtree: true,
      })
    }

    const handleCheckAndAttachFilter = () => {
      if (!isFeatureEnabled) {
        return
      }

      const container = findFeedContainer()
      if (container) {
        handleAttachFilterToContainer(container)
      }
    }

    // Чтение начального состояния настройки
    const initSetting = async () => {
      try {
        isFeatureEnabled = await getStoredFeedsFilterEnabled()
        if (isFeatureEnabled) {
          handleCheckAndAttachFilter()
        }
      } catch (error: unknown) {
        console.warn('[nmap_uploader] FeedsFilter init failed:', error)
      }
    }

    initSetting()

    // Слушатель изменения настроек в хранилище
    const handleStorageChange = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && FEEDS_FILTER_ENABLED_STORAGE_KEY in changes) {
        const nextValue = changes[FEEDS_FILTER_ENABLED_STORAGE_KEY]?.newValue
        if (typeof nextValue === 'boolean') {
          isFeatureEnabled = nextValue
          if (isFeatureEnabled) {
            handleCheckAndAttachFilter()
          } else {
            handleRemoveFilterDropdown()
          }
        }
      }
    }

    browser.storage.onChanged.addListener(handleStorageChange)

    // Отслеживание клика по кнопке истории правок .nk-user-feeds-control-view
    const handleDocumentClick = (event: MouseEvent) => {
      if (!isFeatureEnabled) {
        return
      }

      const target = event.target as HTMLElement | null
      if (!target) {
        return
      }

      const feedsBtn = target.closest('.nk-user-feeds-control-view')
      if (!feedsBtn) {
        return
      }

      // Даем интерфейсу редактора время отрендерить шторку
      setTimeout(handleCheckAndAttachFilter, 150)
      setTimeout(handleCheckAndAttachFilter, 400)
      setTimeout(handleCheckAndAttachFilter, 800)
    }

    document.addEventListener('click', handleDocumentClick, true)

    // Глобальный наблюдатель за появлением контейнера ленты или целевого селекта в DOM
    const bodyObserver = new MutationObserver(() => {
      if (!isFeatureEnabled) {
        return
      }

      const existingSelect = document.getElementById(FEEDS_FILTER_SELECT_ID)
      if (!existingSelect) {
        handleCheckAndAttachFilter()
      } else if (activeFeedContainer) {
        // Проверяем, не появился ли целевой селект, рядом с которым нужно встать
        attachFilterDropdownToDom(existingSelect, activeFeedContainer)
      }
    })

    bodyObserver.observe(document.body, {
      childList: true,
      subtree: true,
    })

    // Синхронизация высоты при изменении размеров окна
    const handleWindowResize = () => {
      if (!isFeatureEnabled || !currentDropdownController) {
        return
      }
      currentDropdownController.syncHeight()
    }

    window.addEventListener('resize', handleWindowResize)

    ctx.onInvalidated(() => {
      window.removeEventListener('resize', handleWindowResize)
      document.removeEventListener('click', handleDocumentClick, true)
      browser.storage.onChanged.removeListener(handleStorageChange)
      bodyObserver.disconnect()
      handleRemoveFilterDropdown()
    })
  },
})
