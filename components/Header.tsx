import { LogOut, Moon, Sun } from 'lucide-react'
import logoUrl from '../assets/logo.svg'
import type { Theme } from '../hooks/useTheme'
import type { YandexUser } from '../lib/yandex/client'

type HeaderProps = {
  theme: Theme
  user: YandexUser | null
  onToggleTheme: () => void
  onLogout: () => void
}

export const Header = ({ theme, user, onToggleTheme, onLogout }: HeaderProps) => {
  const displayName = user?.display_name || user?.real_name || user?.login

  return (
    <header className="sidepanel-header">
      <div className="header-container">
        <div className="logo">
          <img src={logoUrl} alt="" className="logo-icon" width={28} height={28} />
          <span className="logo-text">nmap_uploader</span>
        </div>
        <div className="header-actions">
          {user ? (
            <div className="user-info">
              <span className="user-info-name" title={user.login}>
                {displayName}
              </span>
              <button
                type="button"
                className="btn-icon"
                onClick={onLogout}
                aria-label="Выйти"
                title="Выйти"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="btn-theme-toggle"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>
    </header>
  )
}
