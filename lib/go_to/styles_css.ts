import { GO_TO_SPLIT_STYLES } from './split_styles_css'

export * from './split_styles_css'

export const GO_TO_STYLES_ID = 'nmap-uploader-go-to-styles'

export const GO_TO_BUTTON_HIDDEN_CLASS = 'nmap-uploader-goto-btn--hidden'
export const GO_TO_POPUP_VISIBLE_CLASS = 'nmap-uploader-popup--visible'
export const GO_TO_MENU_ITEM_HOVERED_CLASS = 'nmap-uploader-menu__item--hovered'
export const GO_TO_BUTTON_HOVERED_CLASS = 'nmap-uploader-goto-btn--hovered'

export const GO_TO_STYLES = `
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

@keyframes nmapTooltipFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.nmap-uploader-popup--tooltip {
  position: fixed;
  z-index: 111001;
  padding: 0;
  box-sizing: border-box;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  font:
    400 12px/15px "Yandex Sans Text",
    Arial,
    Helvetica,
    sans-serif;
  box-shadow:
    rgba(0, 0, 0, 0.1) 0px 0px 0px 1px,
    rgba(0, 0, 0, 0.4) 0px 10px 20px -5px;
  pointer-events: none;
  animation: nmapTooltipFadeIn 0.1s ease-out forwards;
}

.nmap-uploader-popup--tooltip .nmap-uploader-popup__content,
.nmap-uploader-popup--tooltip .nk-popup__content {
  padding: 6px 8px 8px;
  margin: 0;
  font-size: 12px;
  line-height: 15px;
  color: #fff;
  white-space: nowrap;
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
    13px/16px "Yandex Sans Text",
    "YS Text",
    Arial,
    Helvetica,
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

.nmap-uploader-polygon-popup.nmap-uploader-popup {
  z-index: 11000;
  display: block;
  box-sizing: border-box;
  width: min(425px, calc(100vw - 24px));
  overflow: hidden;
  border-radius: 4px;
  background: var(--nmap-uploader-popup-bg, #fff);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.1),
    0 10px 20px -5px rgba(0, 0, 0, 0.4);
}

.nmap-uploader-polygon-popup__content {
  width: 100%;
  height: min(580px, calc(100vh - 80px));
  max-height: inherit;
  overflow: hidden;
}

.nmap-uploader-polygon-popup__iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}
${GO_TO_SPLIT_STYLES}
`
