export const GO_TO_SPLIT_ACTIVE_CLASS = 'nmap-uploader-split-active'
export const GO_TO_SPLIT_BUTTON_ACTIVE_CLASS = 'nmap-uploader-split-btn--active'

export const GO_TO_SPLIT_STYLES = `
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

html.nmap-uploader-split-active .nk-app-view,
html.nmap-uploader-split-active .nk-layout-view,
html.nmap-uploader-split-active .nk-map-editor-view,
html.nmap-uploader-split-active .nk-map-view,
html.nmap-uploader-split-active .nk-map,
html.nmap-uploader-split-active [class*="ymaps-2"][class*="-map"],
html.nmap-uploader-split-active .ymaps-2-1-map {
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

.nmap-uploader-split-banner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: fixed;
  top: 22px;
  left: 25vw;
  transform: translate(-50%, -50%);
  height: 38px;
  line-height: 38px;
  padding: 0 16px;
  background-color: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-family: "Yandex Sans Text", Arial, Helvetica, sans-serif;
  font-size: 13px;
  font-weight: 400;
  border-radius: 19px;
  box-shadow: 0 3px 0 0 rgba(0, 0, 0, 0.05);
  pointer-events: none;
  z-index: 2147483647 !important;
  user-select: none;
  white-space: nowrap;
  box-sizing: border-box;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}

.nmap-uploader-split-banner--warning {
  background-color: rgba(220, 38, 38, 0.85);
  box-shadow: 0 3px 0 0 rgba(220, 38, 38, 0.2);
}
`
