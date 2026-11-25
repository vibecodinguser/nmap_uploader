import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { LocaleProvider } from '@/hooks/useLocale'
import { applyThemeTo, initNativeThemeBridge, observeTheme } from '@/lib/theme_bootstrap'
import { App } from './App'

initNativeThemeBridge()
observeTheme((isDark) => {
  applyThemeTo(document.documentElement, isDark)
})

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
