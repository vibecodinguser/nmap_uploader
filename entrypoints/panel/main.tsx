import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { LocaleProvider } from '@/hooks/useLocale'
import { initNativeLocaleBridge } from '@/lib/locale_bootstrap'
import { applyThemeTo, initNativeThemeBridge, observeTheme } from '@/lib/theme_bootstrap'
import { App } from './App'

initNativeThemeBridge()
observeTheme((isDark) => {
  applyThemeTo(document.documentElement, isDark)
})

// Мост нужен до первого рендера: `LocaleProvider` читает язык синхронно.
initNativeLocaleBridge()

const root = document.getElementById('root')
if (!root) {
  throw new Error('Root element not found')
}

const app = (
  <StrictMode>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </StrictMode>
)

const reactRoot = ReactDOM.createRoot(root)
reactRoot.render(app)
