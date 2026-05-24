import { Moon, Sun } from 'lucide-react'
import type { Theme } from '../hooks/useTheme'

type HeaderProps = {
  theme: Theme
  onToggleTheme: () => void
}

export const Header = ({ theme, onToggleTheme }: HeaderProps) => {
  return (
    <header className="sidepanel-header">
      <div className="header-container">
        <span className="logo-text">nmap_uploader</span>
        <button
          type="button"
          className="btn-theme-toggle"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  )
}
