import { FEEDS_FILTER_STYLES_ID } from './constants'
import { FEED_CARD_HIDDEN_STYLES, FEED_POPUP_MENU_STYLES } from './dropdown_popup_styles'

export * from './dropdown_popup_styles'

export const FEED_SELECT_BUTTON_STYLES = `
    #nmap-uploader-feeds-filter-select,
    #nmap-uploader-feeds-action-filter-select,
    .nmap-feeds-status-select,
    .nmap-feeds-action-select {
      display: inline-block !important;
      vertical-align: middle !important;
      margin-left: 8px !important;
      position: relative !important;
      width: 200px !important;
      min-width: 200px !important;
      max-width: 200px !important;
      font-family: var(--nk-user-bar-font-family, "Yandex Sans Text", "YS Text", -apple-system, BlinkMacSystemFont, Arial, sans-serif);
      pointer-events: auto !important;
      box-sizing: border-box !important;
      height: var(--nmap-feeds-select-height, 28px) !important;
      visibility: visible !important;
      opacity: 1 !important;
      z-index: 10 !important;
    }
    .nk-user-events-view__filters {
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      justify-content: flex-start !important;
      gap: 8px !important;
      overflow: visible !important;
      box-sizing: border-box !important;
    }
    .nk-user-events-view__filters .nk-user-events-view__category-group-filter {
      flex: 0 0 auto !important;
      margin: 0 !important;
      width: auto !important;
      box-sizing: border-box !important;
    }
    .nk-user-events-view__filters #nmap-uploader-feeds-action-filter-select,
    .nk-user-events-view__filters .nmap-feeds-action-select {
      flex: 0 0 200px !important;
      margin: 0 !important;
    }
    .nmap-action-marker {
      display: inline-block !important;
      width: 8px !important;
      height: 8px !important;
      min-width: 8px !important;
      min-height: 8px !important;
      border-radius: 50% !important;
      margin: 0 !important;
      flex: 0 0 8px !important;
      flex-shrink: 0 !important;
      vertical-align: middle !important;
      box-sizing: border-box !important;
    }
    .nmap-action-marker.nmap-hidden,
    .nmap-action-marker[hidden] {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      opacity: 0 !important;
      visibility: hidden !important;
    }
    #nmap-uploader-feeds-filter-select .nk-select__button,
    #nmap-uploader-feeds-action-filter-select .nk-select__button,
    .nmap-feeds-status-select .nk-select__button,
    .nmap-feeds-action-select .nk-select__button {
      position: relative !important;
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      justify-content: flex-start !important;
      width: 100% !important;
      height: var(--nmap-feeds-select-height, 28px) !important;
      min-height: var(--nmap-feeds-select-height, 28px) !important;
      max-height: var(--nmap-feeds-select-height, 28px) !important;
      line-height: var(--nmap-feeds-select-height, 28px) !important;
      padding: 0 25px 0 10px !important;
      border: var(--nmap-feeds-select-border, 1px solid rgba(255, 255, 255, 0.4)) !important;
      border-radius: var(--nmap-feeds-select-radius, 4px) !important;
      outline: 0 !important;
      background: var(--nmap-feeds-select-bg, transparent) !important;
      background-color: var(--nmap-feeds-select-bg, transparent) !important;
      color: var(--nmap-feeds-select-color, inherit) !important;
      font-size: 13px !important;
      font-family: inherit !important;
      cursor: pointer !important;
      box-sizing: border-box !important;
      white-space: nowrap !important;
      user-select: none !important;
      pointer-events: auto !important;
      text-align: left !important;
      vertical-align: middle !important;
      overflow: hidden !important;
      transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    }
    #nmap-uploader-feeds-filter-select .nk-select__button::before,
    #nmap-uploader-feeds-action-filter-select .nk-select__button::before,
    .nmap-feeds-status-select .nk-select__button::before,
    .nmap-feeds-action-select .nk-select__button::before {
      display: none !important;
    }
    #nmap-uploader-feeds-filter-select .nk-select__button:hover,
    #nmap-uploader-feeds-action-filter-select .nk-select__button:hover,
    .nmap-feeds-status-select .nk-select__button:hover,
    .nmap-feeds-action-select .nk-select__button:hover {
      background: var(--nmap-feeds-select-hover-bg, rgba(255, 255, 255, 0.08)) !important;
      border-color: var(--nmap-feeds-select-hover-border, rgba(255, 255, 255, 0.6)) !important;
    }
    #nmap-uploader-feeds-filter-select.nk-select_opened .nk-select__button,
    #nmap-uploader-feeds-action-filter-select.nk-select_opened .nk-select__button,
    .nmap-feeds-status-select.nk-select_opened .nk-select__button,
    .nmap-feeds-action-select.nk-select_opened .nk-select__button,
    #nmap-uploader-feeds-filter-select .nk-select__button:focus,
    #nmap-uploader-feeds-action-filter-select .nk-select__button:focus,
    .nmap-feeds-status-select .nk-select__button:focus,
    .nmap-feeds-action-select .nk-select__button:focus {
      outline: 0 !important;
      box-shadow: none !important;
      background: var(--nmap-feeds-select-focus-bg, rgba(255, 255, 255, 0.12)) !important;
      border-color: var(--nmap-feeds-select-hover-border, rgba(255, 255, 255, 0.6)) !important;
    }
    #nmap-uploader-feeds-filter-select .nk-select__text,
    #nmap-uploader-feeds-action-filter-select .nk-select__text,
    .nmap-feeds-status-select .nk-select__text,
    .nmap-feeds-action-select .nk-select__text {
      position: relative !important;
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      flex-wrap: nowrap !important;
      gap: 6px !important;
      margin: 0 !important;
      padding: 0 !important;
      height: 100% !important;
      width: calc(100% - 20px) !important;
      max-width: calc(100% - 20px) !important;
      line-height: normal !important;
      pointer-events: none !important;
      z-index: 1 !important;
      vertical-align: middle !important;
      color: inherit !important;
      overflow: hidden !important;
      white-space: nowrap !important;
      box-sizing: border-box !important;
    }
    #nmap-uploader-feeds-filter-select .nk-select__text > span,
    #nmap-uploader-feeds-action-filter-select .nk-select__text > span,
    .nmap-feeds-status-select .nk-select__text > span,
    .nmap-feeds-action-select .nk-select__text > span {
      display: inline-flex !important;
      align-items: center !important;
      line-height: normal !important;
      vertical-align: middle !important;
    }
    #nmap-uploader-feeds-filter-select .nmap-feeds-button-label,
    #nmap-uploader-feeds-action-filter-select .nmap-feeds-button-label,
    .nmap-feeds-status-select .nmap-feeds-button-label,
    .nmap-feeds-action-select .nmap-feeds-button-label,
    #nmap-uploader-feeds-filter-select .nk-select__text > span:not(.nk-icon):not(.nmap-feeds-button-spinner):not(.nmap-status-count-badge):not(.nmap-action-marker),
    #nmap-uploader-feeds-action-filter-select .nk-select__text > span:not(.nk-icon):not(.nmap-feeds-button-spinner):not(.nmap-status-count-badge):not(.nmap-action-marker),
    .nmap-feeds-status-select .nk-select__text > span:not(.nk-icon):not(.nmap-feeds-button-spinner):not(.nmap-status-count-badge):not(.nmap-action-marker),
    .nmap-feeds-action-select .nk-select__text > span:not(.nk-icon):not(.nmap-feeds-button-spinner):not(.nmap-status-count-badge):not(.nmap-action-marker) {
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
      flex: 0 1 auto !important;
    }
    .nmap-feeds-status-select .nk-icon,
    .nmap-feeds-status-select .nk-commit-state-view {
      display: inline-flex !important;
      position: static !important;
      float: none !important;
      align-items: center !important;
      justify-content: center !important;
      width: 18px !important;
      height: 18px !important;
      min-width: 18px !important;
      min-height: 18px !important;
      max-width: 18px !important;
      max-height: 18px !important;
      margin: 0 !important;
      padding: 0 !important;
      flex-shrink: 0 !important;
      vertical-align: middle !important;
      background: transparent !important;
    }
    .nmap-feeds-status-select .nk-icon svg,
    .nmap-feeds-status-select .nk-commit-state-view svg {
      display: block !important;
      width: 18px !important;
      height: 18px !important;
      margin: 0 !important;
      flex-shrink: 0 !important;
    }
    .nmap-feeds-status-select .nk-icon[hidden],
    .nmap-feeds-status-select .nk-icon.nmap-hidden,
    .nmap-feeds-status-select .nk-icon[style*="display: none"] {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
      min-width: 0 !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
    #nmap-uploader-feeds-filter-select .nmap-status-count-badge,
    #nmap-uploader-feeds-action-filter-select .nmap-status-count-badge,
    .nmap-feeds-status-select .nmap-status-count-badge,
    .nmap-feeds-action-select .nmap-status-count-badge {
      display: inline-block !important;
      margin-left: 2px !important;
      font-size: 11px !important;
      font-weight: 500 !important;
      padding: 0 !important;
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
      border-radius: 0 !important;
      background: transparent !important;
      color: inherit !important;
      opacity: 0.65 !important;
      flex-shrink: 0 !important;
      line-height: normal !important;
      white-space: nowrap !important;
    }

    #nmap-uploader-feeds-filter-select .nk-select__tick,
    #nmap-uploader-feeds-action-filter-select .nk-select__tick,
    .nmap-feeds-status-select .nk-select__tick,
    .nmap-feeds-action-select .nk-select__tick {
      position: absolute !important;
      top: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 25px !important;
      height: 100% !important;
      pointer-events: none !important;
      z-index: 1 !important;
      background-image: var(
        --nmap-feeds-select-tick,
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='6'%3E%3Cpath fill='%23fff' d='M10.3 0L5.5 4.7.7 0 0 .7 5.5 6 11 .7z'/%3E%3C/svg%3E")
      ) !important;
      background-repeat: no-repeat !important;
      background-position: center center !important;
      transition: transform 0.15s ease-out !important;
    }
    #nmap-uploader-feeds-filter-select.nk-select_opened .nk-select__tick,
    #nmap-uploader-feeds-action-filter-select.nk-select_opened .nk-select__tick,
    .nmap-feeds-status-select.nk-select_opened .nk-select__tick,
    .nmap-feeds-action-select.nk-select_opened .nk-select__tick {
      transform: rotate(180deg) !important;
    }
    .nmap-feeds-button-spinner {
      display: inline-block !important;
      width: 14px !important;
      height: 14px !important;
      min-width: 14px !important;
      min-height: 14px !important;
      border: 2px solid rgba(255, 255, 255, 0.3) !important;
      border-radius: 50% !important;
      border-top-color: #ffcc00 !important;
      animation: nmap-feeds-spin 0.8s linear infinite !important;
      flex-shrink: 0 !important;
      box-sizing: border-box !important;
      vertical-align: middle !important;
      margin: 0 !important;
    }
    .nmap-feeds-button-spinner[hidden],
    .nmap-feeds-button-spinner.nmap-hidden,
    .nmap-feeds-button-spinner[style*="display: none"] {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
      min-width: 0 !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
    @keyframes nmap-feeds-spin {
      to {
        transform: rotate(360deg);
      }
    }
`

/**
 * Подключает изолированные CSS-стили для дропдауна фильтра и скрытия карточек.
 */
export const ensureFeedFilterStyles = (): void => {
  if (document.getElementById(FEEDS_FILTER_STYLES_ID)) {
    return
  }

  const styleEl = document.createElement('style')
  styleEl.id = FEEDS_FILTER_STYLES_ID
  styleEl.textContent = `
    ${FEED_CARD_HIDDEN_STYLES}
    ${FEED_SELECT_BUTTON_STYLES}
    ${FEED_POPUP_MENU_STYLES}
  `
  document.head.appendChild(styleEl)
}
