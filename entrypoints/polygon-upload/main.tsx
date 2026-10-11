import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import '@/assets/styles/uploader.css'
import '@/assets/styles/polygon_upload_popup.css'
import { LocaleProvider } from '@/hooks/useLocale'
import { applyStoredDarkTheme } from '@/lib/theme_bootstrap'
import { PolygonUploadApp } from './App'

applyStoredDarkTheme(document.documentElement)

const root = document.getElementById('root')
if (!root) {
  throw new Error('Root element not found')
}

const app = (
  <StrictMode>
    <LocaleProvider>
      <PolygonUploadApp />
    </LocaleProvider>
  </StrictMode>
)

ReactDOM.createRoot(root).render(app)
