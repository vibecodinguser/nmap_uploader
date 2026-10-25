import { analyzeFeedMutations, isFeedContainerReadyForFilter } from './feed_mutation_scanner'
import {
  type ActionFilterDropdownController,
  applyCombinedFeedFilterToDom,
  attachActionFilterDropdownToDom,
  attachFilterDropdownToDom,
  createActionFilterDropdownElement,
  createFeedDailyLoader,
  createFilterDropdownElement,
  FEEDS_ACTION_FILTER_POPUP_ID,
  FEEDS_ACTION_FILTER_SELECT_ID,
  FEEDS_FILTER_POPUP_ID,
  FEEDS_FILTER_SELECT_ID,
  type FeedActionId,
  type FeedDailyLoaderController,
  type FeedStatusId,
  type FilterDropdownController,
  findFeedContainer,
  findTargetSelect,
  isEditsModeSelected,
} from './index'

export class FeedFilterDomAdapter {
  private currentFilter: FeedStatusId = 'all'
  private currentActionFilter: FeedActionId = 'all'
  private currentObserver: MutationObserver | null = null
  private activeFeedContainer: HTMLElement | null = null
  private currentDropdownController: FilterDropdownController | null = null
  private currentActionDropdownController: ActionFilterDropdownController | null = null
  private currentDailyLoader: FeedDailyLoaderController | null = null

  public getActiveContainer(): HTMLElement | null {
    return this.activeFeedContainer
  }

  public getDropdownController(): FilterDropdownController | null {
    return this.currentDropdownController
  }

  public getActionDropdownController(): ActionFilterDropdownController | null {
    return this.currentActionDropdownController
  }

  public checkAndAttach(isFeatureEnabled: boolean): void {
    if (!isFeatureEnabled) {
      return
    }

    const container = findFeedContainer()
    const { ready } = isFeedContainerReadyForFilter(container)
    if (!ready || !container) {
      this.removeFilterDropdown()
      return
    }

    this.attachFilterToContainer(container, isFeatureEnabled)
  }

  public removeFilterDropdown = (): void => {
    this.disconnectFeedObserver()

    if (this.currentDropdownController) {
      this.currentDropdownController.teardown()
      this.currentDropdownController = null
    }

    if (this.currentActionDropdownController) {
      this.currentActionDropdownController.teardown()
      this.currentActionDropdownController = null
    }

    const existingSelect = document.getElementById(FEEDS_FILTER_SELECT_ID)
    if (existingSelect) {
      existingSelect.remove()
    }

    const existingPopup = document.getElementById(FEEDS_FILTER_POPUP_ID)
    if (existingPopup) {
      existingPopup.remove()
    }

    const existingActionSelect = document.getElementById(FEEDS_ACTION_FILTER_SELECT_ID)
    if (existingActionSelect) {
      existingActionSelect.remove()
    }

    const existingActionPopup = document.getElementById(FEEDS_ACTION_FILTER_POPUP_ID)
    if (existingActionPopup) {
      existingActionPopup.remove()
    }

    const hiddenCards = document.querySelectorAll('.nmap-uploader-feed-event-hidden')
    hiddenCards.forEach((card) => {
      card.classList.remove('nmap-uploader-feed-event-hidden')
    })
  }

  public disconnectFeedObserver(): void {
    if (this.currentObserver) {
      this.currentObserver.disconnect()
      this.currentObserver = null
    }
    if (this.currentDailyLoader) {
      this.currentDailyLoader.teardown()
      this.currentDailyLoader = null
    }
    this.activeFeedContainer = null
  }

  public attachFilterToContainer(feedContainer: HTMLElement, isFeatureEnabled: boolean): void {
    if (!isFeatureEnabled) {
      return
    }

    const { ready, targetSelect } = isFeedContainerReadyForFilter(feedContainer)
    if (!ready || !targetSelect) {
      this.removeFilterDropdown()
      return
    }

    if (
      this.activeFeedContainer === feedContainer &&
      feedContainer.isConnected &&
      this.currentDailyLoader &&
      this.currentDropdownController?.element.isConnected &&
      targetSelect.nextElementSibling === this.currentDropdownController.element
    ) {
      return
    }

    this.activeFeedContainer = feedContainer

    const applyFilters = (container: HTMLElement) => {
      return applyCombinedFeedFilterToDom({
        container,
        statusFilter: this.currentFilter,
        actionFilter: this.currentActionFilter,
      })
    }

    if (!this.currentDropdownController) {
      this.currentDropdownController = createFilterDropdownElement(
        (selectedStatus) => {
          this.currentFilter = selectedStatus
          if (this.activeFeedContainer) {
            const { statusStats, actionStats } = applyFilters(this.activeFeedContainer)
            this.currentDropdownController?.updateCounters(statusStats)
            this.currentActionDropdownController?.updateCounters(actionStats)
          }
        },
        this.currentFilter,
        {
          initialDays: 1,
          onPeriodChange: (days) => {
            void this.currentDailyLoader?.loadUpToDays(days)
          },
          onStopLoading: () => {
            this.currentDailyLoader?.stopLoading()
          },
        },
      )
    }

    if (!this.currentActionDropdownController) {
      this.currentActionDropdownController = createActionFilterDropdownElement((selectedAction) => {
        this.currentActionFilter = selectedAction
        if (this.activeFeedContainer) {
          const { statusStats, actionStats } = applyFilters(this.activeFeedContainer)
          this.currentDropdownController?.updateCounters(statusStats)
          this.currentActionDropdownController?.updateCounters(actionStats)
        }
      }, this.currentActionFilter)
    }

    const isAttached = attachFilterDropdownToDom(
      this.currentDropdownController.element,
      feedContainer,
    )

    if (!isAttached) {
      this.removeFilterDropdown()
      return
    }

    // Прикрепляем фильтр действий к секции nk-user-events-view__filters при ее наличии
    attachActionFilterDropdownToDom(this.currentActionDropdownController.element, feedContainer)

    const initialStats = applyFilters(feedContainer)
    this.currentDropdownController.updateCounters(initialStats.statusStats)
    this.currentActionDropdownController.updateCounters(initialStats.actionStats)

    if (!this.currentDailyLoader || !this.currentObserver) {
      this.disconnectFeedObserver()
      this.activeFeedContainer = feedContainer
      this.currentDailyLoader = createFeedDailyLoader(feedContainer, {
        initialDays: 1,
        onStateChange: (isLoading) => {
          this.currentDropdownController?.setLoadingState(isLoading)
        },
        onProgress: (progress) => {
          this.currentDropdownController?.updatePeriodState({
            activeDays: progress.targetDays,
            targetDays: progress.targetDays,
            isLoading: !progress.isFinished,
            loadedCardsCount: progress.loadedCardsCount,
          })
          if (this.activeFeedContainer) {
            const { statusStats, actionStats } = applyFilters(this.activeFeedContainer)
            this.currentDropdownController?.updateCounters(statusStats)
            this.currentActionDropdownController?.updateCounters(actionStats)
          }
        },
      })

      this.currentObserver = new MutationObserver((mutations) => {
        const { hasNewEventCards, shouldCheckPlacement } = analyzeFeedMutations(mutations)

        if (shouldCheckPlacement && this.activeFeedContainer) {
          const currentTarget = findTargetSelect(this.activeFeedContainer)
          if (!currentTarget || !isEditsModeSelected(currentTarget)) {
            this.removeFilterDropdown()
            return
          }
          if (this.currentDropdownController) {
            attachFilterDropdownToDom(
              this.currentDropdownController.element,
              this.activeFeedContainer,
            )
          }
          if (this.currentActionDropdownController) {
            attachActionFilterDropdownToDom(
              this.currentActionDropdownController.element,
              this.activeFeedContainer,
            )
          }
        }

        if (hasNewEventCards && this.activeFeedContainer) {
          const { statusStats, actionStats } = applyFilters(this.activeFeedContainer)
          this.currentDropdownController?.updateCounters(statusStats)
          this.currentActionDropdownController?.updateCounters(actionStats)
        }
      })

      this.currentObserver.observe(feedContainer, {
        childList: true,
        subtree: true,
        characterData: true,
      })
    }
  }

  public syncHeight(): void {
    this.currentDropdownController?.syncHeight()
    this.currentActionDropdownController?.syncHeight()
  }
}
