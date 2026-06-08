import { browser } from 'wxt/browser'

export const PANEL_SIDEBAR_WRAPPER_ID = 'nmapUploaderPanelSidebar'
export const CLOSE_PANEL_SIDEBAR_ACTION = 'closePanelSidebar'

/** Убирает sidebar из DOM (работает из любого content script на вкладке НЯК). */
export const removePanelSidebarFromDom = (): void => {
  document.getElementById(PANEL_SIDEBAR_WRAPPER_ID)?.remove()
}

/** Закрывает injected sidebar панели расширения на текущей вкладке НЯК. */
export const requestClosePanelSidebar = (): void => {
  removePanelSidebarFromDom()

  void browser.runtime.sendMessage({ action: CLOSE_PANEL_SIDEBAR_ACTION }).catch(() => {
    // background или panel-sidebar могут быть недоступны — DOM уже очищен выше
  })
}
