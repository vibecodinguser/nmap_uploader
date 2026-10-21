import {
  FEEDS_FILTER_POPUP_ID,
  FEEDS_FILTER_SELECT_ID,
  findTargetSelect,
  isEditsModeSelected,
} from './index'

export interface MutationAnalysisResult {
  hasNewEventCards: boolean
  shouldCheckPlacement: boolean
}

export const analyzeFeedMutations = (mutations: MutationRecord[]): MutationAnalysisResult => {
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

  return { hasNewEventCards, shouldCheckPlacement }
}

export const isFeedContainerReadyForFilter = (
  container: HTMLElement | null,
): { ready: boolean; targetSelect: HTMLElement | null } => {
  if (!container) {
    return { ready: false, targetSelect: null }
  }

  const targetSelect = findTargetSelect(container)
  if (!targetSelect || !isEditsModeSelected(targetSelect)) {
    return { ready: false, targetSelect: null }
  }

  return { ready: true, targetSelect }
}
