import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import '@/assets/styles/notes_panel.css'
import { LocaleProvider } from '@/hooks/useLocale'
import { applyStoredDarkTheme } from '@/lib/theme_bootstrap'
import { NotesPanelApp } from './App'

applyStoredDarkTheme(document.documentElement)

const root = document.getElementById('root')
if (!root) {
  throw new Error('Root element not found')
}

ReactDOM.createRoot(root).render(
  <StrictMode>
    <LocaleProvider>
      <NotesPanelApp />
    </LocaleProvider>
  </StrictMode>,
)
