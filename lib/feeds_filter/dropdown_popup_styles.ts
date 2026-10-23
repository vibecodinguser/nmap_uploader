import { FEED_HIDDEN_CLASS } from './constants'

export const FEED_POPUP_MENU_STYLES = `
    .nmap-feeds-status-popup {
      position: fixed !important;
      z-index: 2147483647 !important;
      min-width: 175px !important;
      background: var(--nmap-feeds-popup-bg, #2b2b2b) !important;
      color: var(--nmap-feeds-popup-color, #ffffff) !important;
      border-radius: 6px !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.45) !important;
      border: 1px solid var(--nmap-feeds-popup-border, rgba(255, 255, 255, 0.15)) !important;
      padding: 4px 0 !important;
      font-family: var(--nk-user-bar-font-family, "YS Text", -apple-system, BlinkMacSystemFont, Arial, sans-serif) !important;
      font-size: 13px !important;
      box-sizing: border-box !important;
      pointer-events: auto !important;
    }
    .nmap-feeds-status-popup.nk-popup_visible {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
    }
    .nmap-feeds-status-popup .nk-menu__item {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      padding: 6px 12px !important;
      cursor: pointer !important;
      user-select: none !important;
      color: inherit !important;
      transition: background-color 0.1s ease !important;
    }
    .nmap-feeds-status-popup .nk-menu__item:hover {
      background-color: var(--nmap-feeds-popup-hover-bg, rgba(255, 255, 255, 0.08)) !important;
    }
    .nmap-feeds-status-popup .nk-menu__item_checked {
      background-color: var(--nmap-feeds-popup-checked-bg, rgba(255, 255, 255, 0.15)) !important;
      font-weight: 600 !important;
    }
    .nmap-feeds-status-select .nk-commit-state-view,
    .nmap-feeds-status-popup .nk-commit-state-view {
      position: static !important;
      left: auto !important;
      top: auto !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 22px !important;
      height: 22px !important;
      min-width: 22px !important;
      min-height: 22px !important;
      margin: 0 !important;
      padding: 0 !important;
      flex-shrink: 0 !important;
      vertical-align: middle !important;
      background: transparent !important;
    }
    .nmap-feeds-status-select .nk-commit-state-view svg,
    .nmap-feeds-status-popup .nk-commit-state-view svg {
      display: block !important;
      width: 22px !important;
      height: 22px !important;
      margin: 0 !important;
      flex-shrink: 0 !important;
    }
    .nmap-status-count-badge {
      margin-left: auto !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      padding: 1px 6px !important;
      border-radius: 10px !important;
      background: var(--nmap-feeds-badge-bg, rgba(255, 255, 255, 0.16)) !important;
      color: inherit !important;
    }
`

export const FEED_CARD_HIDDEN_STYLES = `
    .${FEED_HIDDEN_CLASS} {
      display: none !important;
    }
`
