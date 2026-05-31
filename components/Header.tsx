import { LogOut } from 'lucide-react'
import logoUrl from '@/assets/logo.png'
import type { YandexUser } from '@/lib/yandex/client'

type HeaderProps = {
  user: YandexUser | null
  onLogout: () => void
}

export const Header = ({ user, onLogout }: HeaderProps) => {
  const displayName = user?.display_name || user?.real_name || user?.login

  return (
    <header className="sidepanel-header">
      <div className="header-container">
        <div className="logo">
          <img src={logoUrl} alt="" className="logo-icon" width={28} height={28} />
          <span className="logo-text">nmap_uploader</span>
        </div>
        {user ? (
          <div className="header-actions">
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
          </div>
        ) : null}
      </div>
    </header>
  )
}
