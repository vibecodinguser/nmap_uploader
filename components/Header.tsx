import { LogIn, LogOut } from 'lucide-react'
import { useTranslate } from '@/hooks/useLocale'
import type { YandexUser } from '@/lib/yandex/client'

type HeaderProps = {
  user: YandexUser | null
  avatarDataUrl: string | null
  isLoggingIn: boolean
  onLogin: () => void
  onLogout: () => void
}

export const Header = ({ user, avatarDataUrl, isLoggingIn, onLogin, onLogout }: HeaderProps) => {
  const t = useTranslate()
  const displayName = user?.display_name || user?.real_name || user?.login

  return (
    <header className="sidepanel-header">
      <div className="header-container">
        {user ? (
          <div className="user-info">
            {avatarDataUrl ? (
              <img
                src={avatarDataUrl}
                alt=""
                className="nk-user-bar-view__user-icon"
                width={40}
                height={40}
                decoding="async"
              />
            ) : null}
            <span className="user-info-name nk-user-bar-view__user-name" title={user.login}>
              {displayName}
            </span>
            <button
              type="button"
              className="btn-icon"
              onClick={onLogout}
              aria-label={t('header.logout')}
              title={t('header.logout')}
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="header-login-btn"
            onClick={onLogin}
            disabled={isLoggingIn}
            aria-busy={isLoggingIn}
            aria-label={t('header.loginAria')}
          >
            <LogIn size={16} aria-hidden />
            <span className="nk-user-bar-view__login">
              {isLoggingIn ? t('header.loggingIn') : t('header.login')}
            </span>
          </button>
        )}
      </div>
    </header>
  )
}
