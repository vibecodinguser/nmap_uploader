export const GO_TO_STYLES_ID = 'nmap-uploader-go-to-styles'

export const GO_TO_BUTTON_HIDDEN_CLASS = 'nmap-uploader-goto-btn--hidden'
export const GO_TO_POPUP_VISIBLE_CLASS = 'nmap-uploader-popup--visible'
export const GO_TO_MENU_ITEM_HOVERED_CLASS = 'nmap-uploader-menu__item--hovered'
export const GO_TO_BUTTON_HOVERED_CLASS = 'nmap-uploader-goto-btn--hovered'
export const GO_TO_SPLIT_ACTIVE_CLASS = 'nmap-uploader-split-active'
export const GO_TO_SPLIT_BUTTON_ACTIVE_CLASS = 'nmap-uploader-split-btn--active'

const GO_TO_STYLES = `
.nmap-uploader-goto-btn {
  margin: 0 0 0 4px !important;
  cursor: pointer;
}

.nmap-uploader-goto-btn--hidden {
  display: none !important;
  pointer-events: none !important;
}

.nmap-uploader-goto-icon svg {
  display: block !important;
  width: 24px !important;
  height: 24px !important;
  margin: 4px auto !important;
  transform: translateY(2px) !important;
  color: #fff !important;
  opacity: 0.65;
  transition: opacity 0.2s ease-in-out;
  pointer-events: none;
}

.nmap-uploader-goto-btn:hover .nmap-uploader-goto-icon svg,
.nmap-uploader-goto-btn--hovered .nmap-uploader-goto-icon svg {
  opacity: 1;
}

.nmap-uploader-popup {
  position: fixed;
  z-index: 10001;
  display: none;
  box-sizing: border-box;
  border-radius: 4px;
}

.nmap-uploader-popup:not(.nmap-uploader-popup--tooltip) {
  background: #fff;
  color: #000;
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
  color: inherit;
  cursor: pointer;
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 16px 16px;
}

.nmap-uploader-menu__item--hovered {
  background-color: var(--nmap-uploader-menu-item-hover-bg, #ffeba0);
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
  overflow: hidden;
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
  width: 6px;
  height: 6px;
  border: none;
  border-radius: 50%;
  background: #ff3b30;
  box-shadow:
    0 0 0 2px #fff,
    0 0 0 4px #ff3b30;
  opacity: 0;
  visibility: hidden;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.nmap-uploader-split__cursor-marker--visible {
  opacity: 1;
  visibility: visible;
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
