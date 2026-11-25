import { useLocale } from '@/hooks/useLocale'
import { requestCloseSettingsPopup } from '@/lib/settings_popup_notify'
import type { YandexUser } from '@/lib/yandex/client'
import { LoginButton } from './LoginButton'
import { UserInfo } from './UserInfo'

type HeaderProps = {
  user: YandexUser | null
  avatarDataUrl: string | null
  isLoggingIn: boolean
  onLogin: () => void
  onLogout: () => void
}

/**
 * Шапка панели расширения: пользователь и закрытие.
 *
 * Кнопка закрытия нужна потому, что попап перекрывает карту, а закрыть его
 * иначе можно только повторным кликом по кнопке в шапке редактора — то есть
 * уйти из попапа, чтобы его убрать.
 *
 * Закрытие идёт через `requestCloseSettingsPopup`: попап живёт в DOM страницы
 * карты, а не в самой панели, поэтому панель посылает `postMessage` родителю,
 * и хост попапа убирает узел. Напрямую убрать родительский iframe страница
 * расширения не может — она в другом документе.
 */
export const Header = ({ user, avatarDataUrl, isLoggingIn, onLogin, onLogout }: HeaderProps) => {
  const { t } = useLocale()

  const content = user ? (
    <UserInfo user={user} avatarDataUrl={avatarDataUrl} onLogout={onLogout} />
  ) : (
    <LoginButton isLoggingIn={isLoggingIn} onLogin={onLogin} />
  )

  return (
    <header className="sidepanel-header">
      <div className="header-container">
        {content}
        <button
          type="button"
          className="header-close-btn"
          title={t('header.closeSidebar')}
          aria-label={t('header.closeSidebar')}
          onClick={requestCloseSettingsPopup}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </header>
  )
}
