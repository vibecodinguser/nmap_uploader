import { analyzeFeedMutations, isFeedContainerReadyForFilter } from './feed_mutation_scanner'
import {
  type ActionFilterDropdownController,
  applyCombinedFeedFilterToDom,
  attachActionFilterDropdownToDom,
  attachFilterDropdownToDom,
  createActionFilterDropdownElement,
  createFeedDailyLoader,
  createFilterDropdownElement,
  FEED_HIDDEN_CLASS,
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
  /** Идёт подгрузка периода: фильтр сносить нельзя, она оборвётся. */
  private isFeedLoading = false

  public getActiveContainer(): HTMLElement | null {
    return this.activeFeedContainer
  }

  public getDropdownController(): FilterDropdownController | null {
    return this.currentDropdownController
  }

  public getActionDropdownController(): ActionFilterDropdownController | null {
    return this.currentActionDropdownController
  }

  public isFeedLoadingNow(): boolean {
    return this.isFeedLoading
  }

  public checkAndAttach(isFeatureEnabled: boolean): void {
    if (!isFeatureEnabled) {
      return
    }

    const container = findFeedContainer()
    const { ready } = isFeedContainerReadyForFilter(container)
    if (!ready || !container) {
      this.removeFilterDropdownUnlessLoading()
      return
    }

    this.attachFilterToContainer(container, isFeatureEnabled)
  }

  /**
   * Снимает фильтр, если не идёт подгрузка.
   *
   * Во время подгрузки DOM ленты транзиентно «не готов»: карточки пересоздаются,
   * селект на миг пропадает. Снос фильтра в этот момент оборвал бы загрузку.
   */
  private removeFilterDropdownUnlessLoading(): void {
    if (this.isFeedLoading) {
      return
    }
    this.removeFilterDropdown()
  }

  /** Применяет текущие фильтры к DOM. */
  private applyFilters(container: HTMLElement): void {
    const { statusStats, actionStats } = applyCombinedFeedFilterToDom({
      container,
      statusFilter: this.currentFilter,
      actionFilter: this.currentActionFilter,
    })
    this.currentDropdownController?.updateCounters(statusStats)
    this.currentActionDropdownController?.updateCounters(actionStats)
  }

  private refreshFilters(): void {
    if (this.activeFeedContainer) {
      this.applyFilters(this.activeFeedContainer)
    }
  }

  /**
   * Временно раскрывает карточки, скрытые фильтром, чтобы было что прокручивать.
   *
   * Нужна, когда фильтр оставил так мало видимых карточек, что лента перестала
   * переполняться и дозагрузка не запускается.
   */
  private revealHiddenCards = (): (() => void) | undefined => {
    const container = this.activeFeedContainer
    if (!container) {
      return undefined
    }

    const hiddenCards = container.querySelectorAll<HTMLElement>(`.${FEED_HIDDEN_CLASS}`)
    if (hiddenCards.length === 0) {
      return undefined
    }

    hiddenCards.forEach((card) => {
      card.classList.remove(FEED_HIDDEN_CLASS)
    })

    return () => this.applyFilters(container)
  }

  public removeFilterDropdown = (): void => {
    this.disconnectFeedObserver()

    // Снимаем фильтр целиком: подгрузка больше не продолжится.
    this.isFeedLoading = false

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
      this.removeFilterDropdownUnlessLoading()
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

    if (!this.currentDropdownController) {
      this.currentDropdownController = createFilterDropdownElement(
        (selectedStatus) => {
          // Фильтр применяется сразу: подгрузка периода продолжается в фоне.
          this.currentFilter = selectedStatus
          this.refreshFilters()
        },
        this.currentFilter,
        {
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
        this.refreshFilters()
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

    this.refreshFilters()

    if (!this.currentDailyLoader || !this.currentObserver) {
      this.disconnectFeedObserver()
      this.activeFeedContainer = feedContainer
      this.isFeedLoading = false

      this.currentDailyLoader = createFeedDailyLoader(feedContainer, {
        autoStart: false,
        revealHiddenCards: this.revealHiddenCards,
        onStateChange: (isLoading) => {
          this.isFeedLoading = isLoading
          this.currentDropdownController?.setLoadingState(isLoading)
          // После завершения пересчитываем счётчики: в ленте появились новые карточки.
          if (!isLoading) {
            this.refreshFilters()
          }
        },
        onProgress: (progress) => {
          this.currentDropdownController?.updatePeriodState({
            activeDays: progress.targetDays,
            targetDays: progress.targetDays,
            isLoading: !progress.isFinished,
            loadedCardsCount: progress.loadedCardsCount,
          })
        },
      })

      this.currentObserver = new MutationObserver((mutations) => {
        const { hasNewEventCards, shouldCheckPlacement } = analyzeFeedMutations(mutations)

        if (shouldCheckPlacement && this.activeFeedContainer) {
          const currentTarget = findTargetSelect(this.activeFeedContainer)
          if (!currentTarget || !isEditsModeSelected(currentTarget)) {
            this.removeFilterDropdownUnlessLoading()
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

        if (hasNewEventCards) {
          this.refreshFilters()
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
