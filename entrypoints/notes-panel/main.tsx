import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import '@/assets/styles/notes_panel.css'
import { LocaleProvider } from '@/hooks/useLocale'
import { applyStoredDarkTheme, applyThemeTo, observeStoredTheme } from '@/lib/theme_bootstrap'
import { NotesPanelApp } from './App'

applyStoredDarkTheme(document.documentElement)

// Панель живёт в постоянно смонтированном iframe: без подписки смена темы в
// боковой панели до неё не доходила, и она оставалась в прежней теме.
observeStoredTheme((isDark) => {
  applyThemeTo(document.documentElement, isDark)
})

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
