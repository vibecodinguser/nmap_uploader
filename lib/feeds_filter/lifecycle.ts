import { analyzeFeedMutations, isFeedContainerReadyForFilter } from './feed_mutation_scanner'
import {
  applyFeedFilterToDom,
  attachFilterDropdownToDom,
  createFeedDailyLoader,
  createFilterDropdownElement,
  ensureFeedFilterStyles,
  FEEDS_FILTER_ENABLED_STORAGE_KEY,
  FEEDS_FILTER_POPUP_ID,
  FEEDS_FILTER_SELECT_ID,
  type FeedDailyLoaderController,
  type FeedStats,
  type FeedStatusId,
  type FilterDropdownController,
  findFeedContainer,
  findTargetSelect,
  getStoredFeedsFilterEnabled,
  isEditsModeSelected,
} from './index'
import {
  CLICK_RETRY_DELAYS_MS,
  type FeedFilterLifecycleOptions,
  isFeedTriggerClick,
  STARTUP_RETRY_DELAYS_MS,
  type StorageChangeEmitter,
} from './lifecycle_config'

export * from './feed_mutation_scanner'
export * from './lifecycle_config'

/**
 * Управляет полным жизненным циклом фильтра ленты правок:
 * DOM-наблюдатели, таймеры ретраев, слушатели событий и интеграция со storage.
 */
export class FeedFilterLifecycleManager {
  private isFeatureEnabled = false
  private currentFilter: FeedStatusId = 'all'
  private currentObserver: MutationObserver | null = null
  private activeFeedContainer: HTMLElement | null = null
  private currentDropdownController: FilterDropdownController | null = null
  private currentDailyLoader: FeedDailyLoaderController | null = null
  private bodyObserver: MutationObserver | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private startupTimeouts: ReturnType<typeof setTimeout>[] = []
  private readonly storageEmitter?: StorageChangeEmitter

  constructor(options?: FeedFilterLifecycleOptions) {
    this.storageEmitter = options?.storage
  }

  public async start(): Promise<void> {
    ensureFeedFilterStyles()

    this.setupBodyObserver()
    this.checkAndAttachFilter()
    this.scheduleStartupRetries()
    this.setupHeartbeat()
    this.setupEventListeners()

    await this.initSettings()
  }

  public stop(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.handleWindowResize)
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', this.handleDocumentClick, true)
    }

    if (this.storageEmitter) {
      this.storageEmitter.onChanged.removeListener(this.handleStorageChange)
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    for (const timeoutId of this.startupTimeouts) {
      clearTimeout(timeoutId)
    }
    this.startupTimeouts = []

    if (this.bodyObserver) {
      this.bodyObserver.disconnect()
      this.bodyObserver = null
    }

    this.removeFilterDropdown()
  }

  public setFeatureEnabled(enabled: boolean): void {
    this.isFeatureEnabled = enabled
    if (this.isFeatureEnabled) {
      this.checkAndAttachFilter()
    } else {
      this.removeFilterDropdown()
    }
  }

  public isEnabled(): boolean {
    return this.isFeatureEnabled
  }

  public checkAndAttachFilter = (): void => {
    if (!this.isFeatureEnabled) {
      return
    }

    const container = findFeedContainer()
    const { ready } = isFeedContainerReadyForFilter(container)
    if (!ready || !container) {
      this.removeFilterDropdown()
      return
    }

    this.attachFilterToContainer(container)
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

  private disconnectFeedObserver(): void {
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

  private attachFilterToContainer(feedContainer: HTMLElement): void {
    if (!this.isFeatureEnabled) {
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

  private setupBodyObserver(): void {
    if (typeof document === 'undefined') {
      return
    }

    this.bodyObserver = new MutationObserver(() => {
      if (!this.isFeatureEnabled) {
        return
      }

      const container = findFeedContainer()
      const { ready, targetSelect } = isFeedContainerReadyForFilter(container)
      if (!ready || !container || !targetSelect) {
        if (this.activeFeedContainer || document.getElementById(FEEDS_FILTER_SELECT_ID)) {
          this.removeFilterDropdown()
        }
        return
      }

      const existingSelect = document.getElementById(FEEDS_FILTER_SELECT_ID)
      if (!existingSelect?.isConnected || container !== this.activeFeedContainer) {
        this.attachFilterToContainer(container)
      } else if (targetSelect.nextElementSibling !== existingSelect) {
        attachFilterDropdownToDom(existingSelect, container)
      }
    })

    this.bodyObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    })
  }

  private scheduleStartupRetries(): void {
    STARTUP_RETRY_DELAYS_MS.forEach((delay) => {
      const timer = setTimeout(() => {
        this.checkAndAttachFilter()
      }, delay)
      this.startupTimeouts.push(timer)
    })
  }

  private setupHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (!this.isFeatureEnabled) {
        return
      }

      const container = findFeedContainer()
      const { ready } = isFeedContainerReadyForFilter(container)
      if (!ready || !container) {
        if (this.activeFeedContainer || document.getElementById(FEEDS_FILTER_SELECT_ID)) {
          this.removeFilterDropdown()
        }
        return
      }

      const existingSelect = document.getElementById(FEEDS_FILTER_SELECT_ID)
      if (!existingSelect?.isConnected || container !== this.activeFeedContainer) {
        this.attachFilterToContainer(container)
      }
    }, 1000)
  }

  private async initSettings(): Promise<void> {
    try {
      this.isFeatureEnabled = await getStoredFeedsFilterEnabled()
      if (this.isFeatureEnabled) {
        this.checkAndAttachFilter()
      } else {
        this.removeFilterDropdown()
      }
    } catch (error: unknown) {
      console.warn('[nmap_uploader] FeedsFilter init failed:', error)
    }
  }

  private setupEventListeners(): void {
    if (this.storageEmitter) {
      this.storageEmitter.onChanged.addListener(this.handleStorageChange)
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('click', this.handleDocumentClick, true)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.handleWindowResize)
    }
  }

  private handleStorageChange = (
    changes: Record<string, { newValue?: unknown }>,
    area: string,
  ): void => {
    if (area === 'local' && FEEDS_FILTER_ENABLED_STORAGE_KEY in changes) {
      const nextValue = changes[FEEDS_FILTER_ENABLED_STORAGE_KEY]?.newValue
      if (typeof nextValue === 'boolean') {
        this.setFeatureEnabled(nextValue)
      }
    }
  }

  private handleDocumentClick = (event: MouseEvent): void => {
    if (!this.isFeatureEnabled) {
      return
    }

    const target = event.target as HTMLElement | null
    if (!isFeedTriggerClick(target)) {
      return
    }

    CLICK_RETRY_DELAYS_MS.forEach((delay) => {
      setTimeout(this.checkAndAttachFilter, delay)
    })
  }

  private handleWindowResize = (): void => {
    if (!this.isFeatureEnabled || !this.currentDropdownController) {
      return
    }
    this.currentDropdownController.syncHeight()
  }
}
