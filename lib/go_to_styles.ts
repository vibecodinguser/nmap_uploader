export const GO_TO_STYLES_ID = 'nmap-uploader-go-to-styles'

export const GO_TO_BUTTON_HIDDEN_CLASS = 'nmap-uploader-goto-btn--hidden'
export const GO_TO_POPUP_VISIBLE_CLASS = 'nmap-uploader-popup--visible'
export const GO_TO_MENU_ITEM_HOVERED_CLASS = 'nmap-uploader-menu__item--hovered'
export const GO_TO_BUTTON_HOVERED_CLASS = 'nmap-uploader-goto-btn--hovered'

const GO_TO_STYLES = `
.nmap-uploader-goto-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  text-decoration: none;
  color: inherit;
}

.nmap-uploader-goto-btn--hidden {
  display: none !important;
  pointer-events: none !important;
}

.nmap-uploader-goto-btn--hovered .nmap-uploader-goto-icon {
  opacity: 0.85;
}

.nmap-uploader-goto-icon {
  display: inline-flex;
  width: 24px;
  height: 24px;
}

.nmap-uploader-goto-icon svg {
  width: 100%;
  height: 100%;
}

.nmap-uploader-popup {
  position: fixed;
  z-index: 10001;
  display: none;
  box-sizing: border-box;
  border-radius: 4px;
  background: #fff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.nmap-uploader-popup--visible {
  display: block;
}

.nmap-uploader-popup__content {
  padding: 4px 0;
}

.nmap-uploader-popup--tooltip {
  z-index: 11001;
  padding: 6px 10px;
  border-radius: 4px;
  background: #3d3d3d;
  color: #fff;
  font:
    13px/16px "YS Text",
    arial,
    helvetica,
    sans-serif;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.nmap-uploader-menu {
  margin: 0;
  padding: 0;
  list-style: none;
  min-width: 180px;
}

.nmap-uploader-menu__item {
  display: block;
  padding: 8px 12px 8px 36px;
  font:
    13px/16px "YS Text",
    arial,
    helvetica,
    sans-serif;
  color: #000;
  cursor: pointer;
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 16px 16px;
}

.nmap-uploader-menu__item--hovered {
  background-color: #ffeba0;
}
`

/** Подключает изолированные стили go-to UI, без классов nk-popup/nk-map-region-view. */
export const ensureGoToStyles = (): void => {
  if (document.getElementById(GO_TO_STYLES_ID)) return

  const style = document.createElement('style')
  style.id = GO_TO_STYLES_ID
  style.textContent = GO_TO_STYLES
  ;(document.head ?? document.documentElement).appendChild(style)
}
