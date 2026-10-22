import { analyzeFeedMutations, isFeedContainerReadyForFilter } from './feed_mutation_scanner'
import {
  applyFeedFilterToDom,
  attachFilterDropdownToDom,
  createFeedDailyLoader,
  createFilterDropdownElement,
  FEEDS_FILTER_POPUP_ID,
  FEEDS_FILTER_SELECT_ID,
  type FeedDailyLoaderController,
  type FeedStats,
  type FeedStatusId,
  type FilterDropdownController,
  findFeedContainer,
  findTargetSelect,
  isEditsModeSelected,
} from './index'

export class FeedFilterDomAdapter {
  private currentFilter: FeedStatusId = 'all'
  private currentObserver: MutationObserver | null = null
  private activeFeedContainer: HTMLElement | null = null
  private currentDropdownController: FilterDropdownController | null = null
  private currentDailyLoader: FeedDailyLoaderController | null = null

  public getActiveContainer(): HTMLElement | null {
    return this.activeFeedContainer
  }

  public getDropdownController(): FilterDropdownController | null {
    return this.currentDropdownController
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

    const existingSelect = document.getElementById(FEEDS_FILTER_SELECT_ID)
    if (existingSelect) {
      existingSelect.remove()
    }

    const existingPopup = document.getElementById(FEEDS_FILTER_POPUP_ID)
    if (existingPopup) {
      existingPopup.remove()
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

    const applyFilter = (container: HTMLElement, filter: FeedStatusId): FeedStats => {
      return applyFeedFilterToDom({ container, filter })
    }

    if (!this.currentDropdownController) {
      this.currentDropdownController = createFilterDropdownElement((selectedStatus) => {
        this.currentFilter = selectedStatus
        if (this.activeFeedContainer) {
          const stats = applyFilter(this.activeFeedContainer, this.currentFilter)
          this.currentDropdownController?.updateCounters(stats)
        }
      }, this.currentFilter)
    }

    const isAttached = attachFilterDropdownToDom(
      this.currentDropdownController.element,
      feedContainer,
    )

    if (!isAttached) {
      this.removeFilterDropdown()
      return
    }

    const initialStats = applyFilter(feedContainer, this.currentFilter)
    this.currentDropdownController.updateCounters(initialStats)

    if (!this.currentDailyLoader || !this.currentObserver) {
      this.disconnectFeedObserver()
      this.activeFeedContainer = feedContainer
      this.currentDailyLoader = createFeedDailyLoader(feedContainer)

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
        }

        if (hasNewEventCards && this.activeFeedContainer && this.currentDropdownController) {
          const stats = applyFilter(this.activeFeedContainer, this.currentFilter)
          this.currentDropdownController.updateCounters(stats)
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
  }
}
