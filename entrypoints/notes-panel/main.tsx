import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import '@/assets/styles/notes_panel.css'
import { LocaleProvider } from '@/hooks/useLocale'
import { initNativeLocaleBridge } from '@/lib/locale_bootstrap'
import { applyThemeTo, initNativeThemeBridge, observeTheme } from '@/lib/theme_bootstrap'
import { NotesPanelApp } from './App'

initNativeThemeBridge()
initNativeLocaleBridge()

// Панель живёт в постоянно смонтированном iframe: без подписки смена темы в
// редакторе до неё не доходила, и она оставалась в прежней теме.
observeTheme((isDark) => {
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
