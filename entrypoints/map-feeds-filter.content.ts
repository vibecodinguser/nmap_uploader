import { browser } from 'wxt/browser'
import { defineContentScript } from 'wxt/utils/define-content-script'
import {
  applyFeedFilter,
  attachFilterDropdownToDom,
  createFeedDailyLoader,
  createFilterDropdownElement,
  ensureFeedFilterStyles,
  FEEDS_FILTER_ENABLED_STORAGE_KEY,
  FEEDS_FILTER_POPUP_ID,
  FEEDS_FILTER_SELECT_ID,
  type FeedDailyLoaderController,
  type FeedStatusId,
  type FilterDropdownController,
  findFeedContainer,
  findTargetSelect,
  getStoredFeedsFilterEnabled,
  isEditsModeSelected,
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
    let currentDailyLoader: FeedDailyLoaderController | null = null

    ensureFeedFilterStyles()

    const handleDisconnectFeedObserver = () => {
      if (currentObserver) {
        currentObserver.disconnect()
        currentObserver = null
      }
      if (currentDailyLoader) {
        currentDailyLoader.teardown()
        currentDailyLoader = null
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

      const targetSelect = findTargetSelect(feedContainer)
      // Наш дропдаун должен отображаться ТОЛЬКО тогда, когда выбран пункт "Правки"
      if (!targetSelect || !isEditsModeSelected(targetSelect)) {
        handleRemoveFilterDropdown()
        return
      }

      // Защита от повторного сброса и прерывания текущей загрузки:
      // Если контейнер тот же самый, он всё ещё в DOM, лоадер работает и селект уже в DOM и расположен за targetSelect
      if (
        activeFeedContainer === feedContainer &&
        feedContainer.isConnected &&
        currentDailyLoader &&
        currentDropdownController?.element.isConnected &&
        targetSelect.nextElementSibling === currentDropdownController.element
      ) {
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
      const isAttached = attachFilterDropdownToDom(currentDropdownController.element, feedContainer)

      if (!isAttached) {
        handleRemoveFilterDropdown()
        return
      }

      // Применяем фильтр к уже существующим карточкам
      const initialStats = applyFeedFilter(feedContainer, currentFilter)
      currentDropdownController.updateCounters(initialStats)

      // Отслеживаем динамическую подгрузку элементов при скролле (infinite scroll)
      if (!currentDailyLoader || !currentObserver) {
        handleDisconnectFeedObserver()
        activeFeedContainer = feedContainer
        currentDailyLoader = createFeedDailyLoader(feedContainer)

        currentObserver = new MutationObserver((mutations) => {
          let hasNewEventCards = false
          let shouldCheckPlacement = false

          for (const mutation of mutations) {
            if (mutation.type === 'characterData') {
              shouldCheckPlacement = true
            }

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
                  node.matches('.nk-select, [class*="nk-select"], [class*="select"]') ||
                  node.querySelector('.nk-select, [class*="nk-select"], [class*="select"]')
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

          if (shouldCheckPlacement && activeFeedContainer) {
            const currentTarget = findTargetSelect(activeFeedContainer)
            if (!currentTarget || !isEditsModeSelected(currentTarget)) {
              handleRemoveFilterDropdown()
              return
            }
            if (currentDropdownController) {
              attachFilterDropdownToDom(currentDropdownController.element, activeFeedContainer)
            }
          }

          if (hasNewEventCards && activeFeedContainer && currentDropdownController) {
            const stats = applyFeedFilter(activeFeedContainer, currentFilter)
            currentDropdownController.updateCounters(stats)
          }
        })

        currentObserver.observe(feedContainer, {
          childList: true,
          subtree: true,
          characterData: true,
        })
      }
    }

    const handleCheckAndAttachFilter = () => {
      if (!isFeatureEnabled) {
        return
      }

      const container = findFeedContainer()
      if (!container) {
        handleRemoveFilterDropdown()
        return
      }

      const targetSelect = findTargetSelect(container)
      if (!targetSelect || !isEditsModeSelected(targetSelect)) {
        handleRemoveFilterDropdown()
        return
      }

      handleAttachFilterToContainer(container)
    }

    // Глобальный наблюдатель за появлением контейнера ленты или целевого селекта в DOM.
    // Запускается немедленно, чтобы не упустить мутации во время асинхронного чтения настроек.
    const bodyObserver = new MutationObserver(() => {
      if (!isFeatureEnabled) {
        return
      }

      const container = findFeedContainer()
      if (!container) {
        if (activeFeedContainer || document.getElementById(FEEDS_FILTER_SELECT_ID)) {
          handleRemoveFilterDropdown()
        }
        return
      }

      const targetSelect = findTargetSelect(container)
      if (!targetSelect || !isEditsModeSelected(targetSelect)) {
        if (activeFeedContainer || document.getElementById(FEEDS_FILTER_SELECT_ID)) {
          handleRemoveFilterDropdown()
        }
        return
      }

      const existingSelect = document.getElementById(FEEDS_FILTER_SELECT_ID)
      if (!existingSelect?.isConnected || container !== activeFeedContainer) {
        handleAttachFilterToContainer(container)
      } else if (targetSelect.nextElementSibling !== existingSelect) {
        attachFilterDropdownToDom(existingSelect, container)
      }
    })

    bodyObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    // Немедленная проверка и серия повторных попыток при старте страницы:
    // SPA Народной карты загружает интерфейс и чанки асинхронно
    handleCheckAndAttachFilter()

    const STARTUP_RETRY_DELAYS_MS = [100, 250, 500, 800, 1200, 1800, 2500, 3500, 5000]
    const startupTimeouts: ReturnType<typeof setTimeout>[] = []
    STARTUP_RETRY_DELAYS_MS.forEach((delay) => {
      const timer = setTimeout(() => {
        handleCheckAndAttachFilter()
      }, delay)
      startupTimeouts.push(timer)
    })

    // Периодическая проверка наличия и корректного размещения селекта (heartbeat):
    // Гарантирует появление селекта при открытии шторки, переходе по вкладкам
    // или тихом обновлении DOM без явных событий клика
    const heartbeatTimer = setInterval(() => {
      if (!isFeatureEnabled) {
        return
      }

      const container = findFeedContainer()
      if (!container) {
        if (activeFeedContainer || document.getElementById(FEEDS_FILTER_SELECT_ID)) {
          handleRemoveFilterDropdown()
        }
        return
      }

      const targetSelect = findTargetSelect(container)
      if (!targetSelect || !isEditsModeSelected(targetSelect)) {
        if (activeFeedContainer || document.getElementById(FEEDS_FILTER_SELECT_ID)) {
          handleRemoveFilterDropdown()
        }
        return
      }

      const existingSelect = document.getElementById(FEEDS_FILTER_SELECT_ID)
      if (!existingSelect?.isConnected || container !== activeFeedContainer) {
        handleAttachFilterToContainer(container)
      }
    }, 1000)

    // Чтение начального состояния настройки
    const initSetting = async () => {
      try {
        isFeatureEnabled = await getStoredFeedsFilterEnabled()
        if (isFeatureEnabled) {
          handleCheckAndAttachFilter()
        } else {
          handleRemoveFilterDropdown()
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

    // Отслеживание клика по кнопке истории правок или колокольчику уведомлений
    const handleDocumentClick = (event: MouseEvent) => {
      if (!isFeatureEnabled) {
        return
      }

      const target = event.target as HTMLElement | null
      if (!target) {
        return
      }

      const isFeedTrigger = target.closest(
        '.nk-user-feeds-control-view, [class*="user-feeds-control"], [class*="feeds-control"], [class*="user-bar-view"] [class*="feed"], [class*="user-bar-view"] [class*="notification"], [data-name="feeds"], [aria-label*="лент" i], [aria-label*="истори" i], [title*="лент" i], [title*="истори" i]',
      )
      const isSelectOrMenu = target.closest(
        '.nk-select, .nk-menu, .nk-menu__item, .nk-popup, [role="menuitem"], [role="option"], [role="listbox"], button',
      )

      if (!isFeedTrigger && !isSelectOrMenu) {
        return
      }

      // Даем интерфейсу редактора время отрендерить шторку или переключить режим ленты
      const CLICK_RETRY_DELAYS_MS = [30, 100, 250, 500, 800, 1200]
      CLICK_RETRY_DELAYS_MS.forEach((delay) => {
        setTimeout(handleCheckAndAttachFilter, delay)
      })
    }

    document.addEventListener('click', handleDocumentClick, true)

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
      clearInterval(heartbeatTimer)
      for (const timeoutId of startupTimeouts) {
        clearTimeout(timeoutId)
      }
      bodyObserver.disconnect()
      handleRemoveFilterDropdown()
    })
  },
})
