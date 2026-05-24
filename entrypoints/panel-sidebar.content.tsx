import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './panel/App'
import '../assets/styles/globals.css'

const PANEL_WIDTH = 400
const Z_INDEX = 2_147_483_647

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',

  async main(ctx) {
    let isOpen = false

    const getInitialTheme = (): 'dark' | '' => {
      const stored = localStorage.getItem('theme')
      if (stored === 'dark') return 'dark'
      if (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
      return ''
    }

    const ui = await createShadowRootUi(ctx, {
      name: 'nmap-sidebar',
      position: 'inline',
      anchor: 'body',
      append: 'last',
      css: `
        :host {
          all: initial;
          position: fixed !important;
          top: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: ${PANEL_WIDTH}px !important;
          z-index: ${Z_INDEX} !important;
          display: block !important;
          overflow: hidden !important;
          box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12) !important;
        }
        html, body {
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
        }
      `,
      onMount(container) {
        container.style.cssText = 'width:100%;height:100%;overflow:hidden;'

        const initialTheme = getInitialTheme()
        if (initialTheme) container.classList.add(initialTheme)

        const root = ReactDOM.createRoot(container)
        root.render(
          <React.StrictMode>
            <App themeTarget={container} />
          </React.StrictMode>,
        )
        return root
      },
      onRemove(root) {
        root?.unmount()
      },
    })

    const togglePanel = () => {
      if (isOpen) {
        ui.remove()
        isOpen = false
        return
      }
      ui.mount()
      isOpen = true
    }

    browser.runtime.onMessage.addListener((message) => {
      if (message?.action !== 'togglePanel') return
      togglePanel()
    })
  },
})
