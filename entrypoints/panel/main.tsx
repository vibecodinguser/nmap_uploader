import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '../../assets/styles/globals.css'

const storedTheme = localStorage.getItem('theme')
if (
  storedTheme === 'dark' ||
  (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
) {
  document.documentElement.classList.add('dark')
}

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
