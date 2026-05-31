import React from 'react'
import ReactDOM from 'react-dom/client'
import { applyStoredDarkTheme } from '@/lib/theme_bootstrap'
import { App } from './App'

applyStoredDarkTheme(document.documentElement)

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
