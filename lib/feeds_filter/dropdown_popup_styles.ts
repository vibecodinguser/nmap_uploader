import { FEED_HIDDEN_CLASS } from './constants'

export const FEED_POPUP_MENU_STYLES = `
    #nmap-uploader-feeds-filter-popup,
    #nmap-uploader-feeds-action-filter-popup,
    .nmap-feeds-status-popup,
    .nmap-feeds-action-popup {
      position: fixed !important;
      z-index: 2147483647 !important;
      width: 200px !important;
      min-width: 200px !important;
      max-width: 200px !important;
      background: #333333 !important;
      color: #bfbfbf !important;
      border-radius: 4px !important;
      box-shadow: rgba(0, 0, 0, 0.1) 0px 0px 0px 1px, rgba(0, 0, 0, 0.4) 0px 10px 20px -5px !important;
      border: 0px none !important;
      padding: 0px !important;
      font-family: "Yandex Sans Text", Arial, Helvetica, sans-serif !important;
      font-size: 13px !important;
      line-height: 15px !important;
      box-sizing: border-box !important;
      pointer-events: auto !important;
    }
    #nmap-uploader-feeds-filter-popup.nk-popup_visible,
    #nmap-uploader-feeds-action-filter-popup.nk-popup_visible,
    .nmap-feeds-status-popup.nk-popup_visible,
    .nmap-feeds-action-popup.nk-popup_visible {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
    }
    #nmap-uploader-feeds-filter-popup .nk-popup__content,
    #nmap-uploader-feeds-action-filter-popup .nk-popup__content,
    .nmap-feeds-status-popup .nk-popup__content,
    .nmap-feeds-action-popup .nk-popup__content {
      padding: 4px 0 !important;
      background: transparent !important;
      border-radius: 4px !important;
    }
    #nmap-uploader-feeds-filter-popup .nk-menu,
    #nmap-uploader-feeds-action-filter-popup .nk-menu,
    .nmap-feeds-status-popup .nk-menu,
    .nmap-feeds-action-popup .nk-menu {
      background: #333333 !important;
      color: #bfbfbf !important;
      border: none !important;
      box-shadow: none !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    #nmap-uploader-feeds-filter-popup .nk-menu-item,
    #nmap-uploader-feeds-action-filter-popup .nk-menu-item,
    #nmap-uploader-feeds-filter-popup .nk-menu__item,
    #nmap-uploader-feeds-action-filter-popup .nk-menu__item,
    .nmap-feeds-status-popup .nk-menu-item,
    .nmap-feeds-action-popup .nk-menu-item,
    .nmap-feeds-status-popup .nk-menu__item,
    .nmap-feeds-action-popup .nk-menu__item {
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      flex-wrap: nowrap !important;
      gap: 8px !important;
      padding: 6px 14px !important;
      cursor: pointer !important;
      user-select: none !important;
      color: #bfbfbf !important;
      background: transparent !important;
      box-sizing: border-box !important;
      white-space: nowrap !important;
      transition: background-color 0.1s ease, color 0.1s ease !important;
    }
    #nmap-uploader-feeds-filter-popup .nk-menu-item::before,
    #nmap-uploader-feeds-action-filter-popup .nk-menu-item::before,
    #nmap-uploader-feeds-filter-popup .nk-menu__item::before,
    #nmap-uploader-feeds-action-filter-popup .nk-menu__item::before,
    .nmap-feeds-status-popup .nk-menu-item::before,
    .nmap-feeds-action-popup .nk-menu-item::before,
    .nmap-feeds-status-popup .nk-menu__item::before,
    .nmap-feeds-action-popup .nk-menu__item::before {
      display: none !important;
    }
    #nmap-uploader-feeds-filter-popup .nk-menu-item:hover,
    #nmap-uploader-feeds-action-filter-popup .nk-menu-item:hover,
    #nmap-uploader-feeds-filter-popup .nk-menu__item:hover,
    #nmap-uploader-feeds-action-filter-popup .nk-menu__item:hover,
    .nmap-feeds-status-popup .nk-menu-item:hover,
    .nmap-feeds-action-popup .nk-menu-item:hover,
    .nmap-feeds-status-popup .nk-menu__item:hover,
    .nmap-feeds-action-popup .nk-menu__item:hover,
    .nmap-feeds-status-popup .nk-menu-item_hovered,
    .nmap-feeds-action-popup .nk-menu-item_hovered {
      background-color: #4d4d4d !important;
      color: #ffffff !important;
    }
    #nmap-uploader-feeds-filter-popup .nk-menu-item_checked,
    #nmap-uploader-feeds-action-filter-popup .nk-menu-item_checked,
    #nmap-uploader-feeds-filter-popup .nk-menu__item_checked,
    #nmap-uploader-feeds-action-filter-popup .nk-menu__item_checked,
    .nmap-feeds-status-popup .nk-menu-item_checked,
    .nmap-feeds-action-popup .nk-menu-item_checked,
    .nmap-feeds-status-popup .nk-menu__item_checked,
    .nmap-feeds-action-popup .nk-menu__item_checked {
      background-color: #444444 !important;
      color: #ffffff !important;
      font-weight: 500 !important;
    }
    #nmap-uploader-feeds-filter-popup .nk-menu__text,
    #nmap-uploader-feeds-action-filter-popup .nk-menu__text,
    #nmap-uploader-feeds-filter-popup .nk-menu-item__text,
    #nmap-uploader-feeds-action-filter-popup .nk-menu-item__text,
    .nmap-feeds-status-popup .nk-menu__text,
    .nmap-feeds-action-popup .nk-menu__text,
    .nmap-feeds-status-popup .nk-menu-item__text,
    .nmap-feeds-action-popup .nk-menu-item__text {
      color: inherit !important;
      flex: 1 1 auto !important;
      display: inline-block !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
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
      font-weight: 500 !important;
      padding: 0 !important;
      border-radius: 0 !important;
      background: transparent !important;
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
      color: inherit !important;
      opacity: 0.65 !important;
      flex-shrink: 0 !important;
    }

    .nmap-feeds-period-section {
      border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
      margin-top: 4px !important;
      padding: 8px 14px 8px 14px !important;
      box-sizing: border-box !important;
      background: #333333 !important;
      color: #bfbfbf !important;
    }
    .nmap-feeds-period-header {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      opacity: 0.65 !important;
      margin-bottom: 6px !important;
      text-transform: uppercase !important;
      letter-spacing: 0.5px !important;
      color: #bfbfbf !important;
    }
    .nmap-feeds-period-buttons {
      display: flex !important;
      gap: 6px !important;
      margin-bottom: 6px !important;
    }
    .nmap-feeds-period-btn {
      flex: 1 1 0 !important;
      padding: 4px 0 !important;
      border-radius: 4px !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
      background: transparent !important;
      color: #bfbfbf !important;
      font-size: 12px !important;
      font-family: inherit !important;
      font-weight: 500 !important;
      cursor: pointer !important;
      text-align: center !important;
      transition: all 0.15s ease !important;
      user-select: none !important;
    }
    .nmap-feeds-period-btn:hover {
      background: #4d4d4d !important;
      border-color: rgba(255, 255, 255, 0.4) !important;
      color: #ffffff !important;
    }
    .nmap-feeds-period-btn.nmap-feeds-period-btn_active {
      background: rgba(255, 204, 0, 0.15) !important;
      border-color: #ffcc00 !important;
      color: #ffcc00 !important;
      font-weight: 600 !important;
    }
    .nmap-feeds-period-status-row {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 8px !important;
      font-size: 11px !important;
      min-height: 22px !important;
      margin-top: 4px !important;
      color: #999999 !important;
    }
    .nmap-feeds-period-status-text {
      flex: 1 !important;
      color: inherit !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }
    .nmap-feeds-period-stop-btn {
      padding: 2px 6px !important;
      font-size: 11px !important;
      border-radius: 3px !important;
      border: 1px solid rgba(255, 100, 100, 0.5) !important;
      background: rgba(255, 100, 100, 0.15) !important;
      color: #ff9999 !important;
      cursor: pointer !important;
      white-space: nowrap !important;
      transition: all 0.15s ease !important;
    }
    .nmap-feeds-period-stop-btn:hover {
      background: rgba(255, 100, 100, 0.3) !important;
      border-color: #ff6464 !important;
      color: #ffffff !important;
    }


`

export const FEED_CARD_HIDDEN_STYLES = `
    .${FEED_HIDDEN_CLASS} {
      display: none !important;
    }
`
