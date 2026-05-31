import React from 'react'
import ReactDOM from 'react-dom/client'
import { getStoredThemeMode, resolveTheme } from '@/hooks/useTheme'
import { App } from './App'
import '@/assets/styles/globals.css'

if (resolveTheme(getStoredThemeMode()) === 'dark') {
  document.documentElement.classList.add('dark')
}

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
