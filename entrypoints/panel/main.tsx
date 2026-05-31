import React from 'react'
import ReactDOM from 'react-dom/client'
import { getStoredThemeMode, resolveTheme } from '@/hooks/useTheme'
import { applyBrowserDarkThemeVars } from '@/lib/browser_theme'
import { App } from './App'
import '@/assets/styles/globals.css'

const isDarkTheme = resolveTheme(getStoredThemeMode()) === 'dark'
if (isDarkTheme) {
  document.documentElement.classList.add('dark')
  applyBrowserDarkThemeVars(document.documentElement, true)
}

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
