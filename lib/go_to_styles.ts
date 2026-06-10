export const GO_TO_STYLES_ID = 'nmap-uploader-go-to-styles'

export const GO_TO_BUTTON_HIDDEN_CLASS = 'nmap-uploader-goto-btn--hidden'
export const GO_TO_POPUP_VISIBLE_CLASS = 'nmap-uploader-popup--visible'
export const GO_TO_MENU_ITEM_HOVERED_CLASS = 'nmap-uploader-menu__item--hovered'
export const GO_TO_BUTTON_HOVERED_CLASS = 'nmap-uploader-goto-btn--hovered'
export const GO_TO_SPLIT_ACTIVE_CLASS = 'nmap-uploader-split-active'
export const GO_TO_SPLIT_BUTTON_ACTIVE_CLASS = 'nmap-uploader-split-btn--active'

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
  color: #fff;
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

.nmap-uploader-split-btn--active .nmap-uploader-goto-icon {
  opacity: 1;
  color: #4d8eff;
}

html.nmap-uploader-split-active,
html.nmap-uploader-split-active body {
  width: 50vw !important;
  max-width: 50vw !important;
  overflow: hidden !important;
}

html.nmap-uploader-split-active .nk-app-view {
  width: 50vw !important;
  max-width: 50vw !important;
}

.nmap-uploader-split {
  position: fixed;
  top: 0;
  right: 0;
  width: 50vw;
  height: 100vh;
  z-index: 2147483640;
  box-sizing: border-box;
  border-left: 2px solid rgba(0, 0, 0, 0.25);
  background: #fff;
}

.nmap-uploader-split__iframe-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}

.nmap-uploader-split__iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

.nmap-uploader-split__cursor-overlay,
.nmap-uploader-split__left-cursor-overlay {
  position: fixed;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 2147483641;
}

.nmap-uploader-split__cursor-overlay {
  right: 0;
  left: 50vw;
  width: 50vw;
  height: 100vh;
}

.nmap-uploader-split__left-cursor-overlay {
  width: 50vw;
  height: 100vh;
}

.nmap-uploader-split__cursor-marker {
  position: absolute;
  top: 0;
  left: 0;
  width: 18px;
  height: 18px;
  margin: -9px 0 0 -9px;
  border: 2px solid #ff3b30;
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.9);
  opacity: 0;
  transition: opacity 0.1s ease;
  pointer-events: none;
}

.nmap-uploader-split__cursor-marker--visible {
  opacity: 1;
}

.nmap-uploader-split__cursor-marker--remote::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2px;
  height: 2px;
  margin: -1px 0 0 -1px;
  background: #ff3b30;
  border-radius: 50%;
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
