import React from 'react'
import ReactDOM from 'react-dom/client'
import { browser } from 'wxt/browser'
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root'
import { defineContentScript } from 'wxt/utils/define-content-script'
import { getStoredThemeMode, resolveTheme } from '@/hooks/useTheme'
import { ensureStrokeRecolorEngine } from '@/lib/stroke_recolor_engine'
import { App } from './panel/App'
import '@/assets/styles/globals.css'

const PANEL_WIDTH = 425
const Z_INDEX = 2_147_483_647

// WXT подхватывает default export при сборке; статического import нет
// noinspection JSUnusedGlobalSymbols
export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',

  async main(ctx) {
    ensureStrokeRecolorEngine()

    let isOpen = false
    let isUiReady = false
    let pendingToggle = false
    let ui: Awaited<ReturnType<typeof createShadowRootUi>> | undefined

    const togglePanel = () => {
      if (!ui) return

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

      if (!isUiReady) {
        pendingToggle = true
        return
      }

      togglePanel()
    })

    ui = await createShadowRootUi(ctx, {
      name: 'nmap-sidebar',
      position: 'inline',
      anchor: 'body',
      append: 'last',
      css: `
        :host {
          all: initial;
          --background: #ffffff;
          --foreground: #020817;
          --muted: #f1f5f9;
          --muted-foreground: #64748b;
          --border: #e2e8f0;
          --input: #e2e8f0;
          --primary: #0f172a;
          --primary-foreground: #ffffff;
          --ring: #0f172a;
          --radius: 0.375rem;
          --font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          position: fixed !important;
          top: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: ${PANEL_WIDTH}px !important;
          z-index: ${Z_INDEX} !important;
          display: block !important;
          overflow: hidden !important;
          box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12) !important;
          font-family: var(--font-family, sans-serif);
          background-color: var(--background);
          color: var(--foreground);
        }
        :host(.dark) {
          --background: #292927;
          --foreground: #ededed;
          --muted: #3b3b3b;
          --muted-foreground: #999999;
          --border: #525252;
          --input: #525252;
          --primary: #505050;
          --primary-foreground: #ffffff;
          --ring: #6d6d6d;
          --header-bg: rgba(41, 41, 39, 0.97);
          --header-bg-blur: rgba(41, 41, 39, 0.88);
          box-shadow: -4px 0 24px rgba(0, 0, 0, 0.45) !important;
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

        if (resolveTheme(getStoredThemeMode()) === 'dark') {
          container.classList.add('dark')
          const host = container.getRootNode()
          if (host instanceof ShadowRoot && host.host instanceof HTMLElement) {
            host.host.classList.add('dark')
          }
        }

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

    isUiReady = true

    if (pendingToggle) {
      pendingToggle = false
      togglePanel()
    }
  },
})
