import { FEEDS_FILTER_STYLES_ID } from './constants'
import { FEED_CARD_HIDDEN_STYLES, FEED_POPUP_MENU_STYLES } from './dropdown_popup_styles'

export * from './dropdown_popup_styles'

export const FEED_SELECT_BUTTON_STYLES = `
    .nmap-feeds-status-select {
      display: inline-block !important;
      vertical-align: middle !important;
      margin-left: 8px !important;
      position: relative !important;
      font-family: var(--nk-user-bar-font-family, "YS Text", -apple-system, BlinkMacSystemFont, Arial, sans-serif);
      pointer-events: auto !important;
      box-sizing: border-box !important;
      height: var(--nmap-feeds-select-height, 28px) !important;
      visibility: visible !important;
      opacity: 1 !important;
      z-index: 10 !important;
    }
    .nmap-feeds-status-select .nk-select__button {
      position: relative !important;
      display: inline-flex !important;
      align-items: center !important;
      width: 100% !important;
      height: var(--nmap-feeds-select-height, 28px) !important;
      min-height: var(--nmap-feeds-select-height, 28px) !important;
      max-height: var(--nmap-feeds-select-height, 28px) !important;
      line-height: var(--nmap-feeds-select-height, 28px) !important;
      padding: 0 25px 0 0 !important;
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
      vertical-align: top !important;
      transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .nmap-feeds-status-select .nk-select__button::before {
      display: none !important;
    }
    .nmap-feeds-status-select .nk-select__button:hover {
      background: var(--nmap-feeds-select-hover-bg, rgba(255, 255, 255, 0.08)) !important;
      border-color: var(--nmap-feeds-select-hover-border, rgba(255, 255, 255, 0.6)) !important;
    }
    .nmap-feeds-status-select.nk-select_opened .nk-select__button,
    .nmap-feeds-status-select .nk-select__button:focus {
      background: var(--nmap-feeds-select-focus-bg, rgba(255, 255, 255, 0.12)) !important;
      border-color: #ffcc00 !important;
      box-shadow: 0 0 0 1px #ffcc00, inset 0 0 0 1px #ffcc00 !important;
    }
    .nmap-feeds-status-select .nk-select__text {
      position: relative !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      margin: 0 0 0 10px !important;
      height: 100% !important;
      line-height: inherit !important;
      pointer-events: none !important;
      z-index: 1 !important;
      vertical-align: top !important;
      color: inherit !important;
    }
    .nmap-feeds-status-select .nk-select__tick {
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
    .nmap-feeds-status-select.nk-select_opened .nk-select__tick {
      transform: rotate(180deg) !important;
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
