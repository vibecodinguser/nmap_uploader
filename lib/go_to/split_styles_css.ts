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
