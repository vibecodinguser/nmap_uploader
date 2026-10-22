import { FeedFilterDomAdapter } from './dom_lifecycle_adapter'
import { isFeedContainerReadyForFilter } from './feed_mutation_scanner'
import { attachFeedFilterDomListeners } from './feeds_filter_listeners'
import {
  attachFilterDropdownToDom,
  ensureFeedFilterStyles,
  FEEDS_FILTER_ENABLED_STORAGE_KEY,
  FEEDS_FILTER_SELECT_ID,
  findFeedContainer,
  getStoredFeedsFilterEnabled,
} from './index'
import {
  type FeedFilterLifecycleOptions,
  STARTUP_RETRY_DELAYS_MS,
  type StorageChangeEmitter,
} from './lifecycle_config'

export * from './dom_lifecycle_adapter'
export * from './feed_mutation_scanner'
export * from './feeds_filter_listeners'
export * from './lifecycle_config'

/**
 * Управляет полным жизненным циклом фильтра ленты правок:
 * DOM-наблюдатели, таймеры ретраев, слушатели событий и интеграция со storage.
 */
export class FeedFilterLifecycleManager {
  private isFeatureEnabled = false
  private readonly domAdapter = new FeedFilterDomAdapter()
  private bodyObserver: MutationObserver | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private startupTimeouts: ReturnType<typeof setTimeout>[] = []
  private readonly storageEmitter?: StorageChangeEmitter
  private cleanupDomListeners?: () => void

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
    if (this.cleanupDomListeners) {
      this.cleanupDomListeners()
      this.cleanupDomListeners = undefined
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
    this.domAdapter.checkAndAttach(this.isFeatureEnabled)
  }

  public removeFilterDropdown = (): void => {
    this.domAdapter.removeFilterDropdown()
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
        if (
          this.domAdapter.getActiveContainer() ||
          document.getElementById(FEEDS_FILTER_SELECT_ID)
        ) {
          this.removeFilterDropdown()
        }
        return
      }

      const existingSelect = document.getElementById(FEEDS_FILTER_SELECT_ID)
      if (!existingSelect?.isConnected || container !== this.domAdapter.getActiveContainer()) {
        this.domAdapter.attachFilterToContainer(container, this.isFeatureEnabled)
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
        if (
          this.domAdapter.getActiveContainer() ||
          document.getElementById(FEEDS_FILTER_SELECT_ID)
        ) {
          this.removeFilterDropdown()
        }
        return
      }

      const existingSelect = document.getElementById(FEEDS_FILTER_SELECT_ID)
      if (!existingSelect?.isConnected || container !== this.domAdapter.getActiveContainer()) {
        this.domAdapter.attachFilterToContainer(container, this.isFeatureEnabled)
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

    this.cleanupDomListeners = attachFeedFilterDomListeners({
      isFeatureEnabled: () => this.isFeatureEnabled,
      checkAndAttachFilter: this.checkAndAttachFilter,
      syncHeight: () => this.domAdapter.syncHeight(),
    })
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
}
