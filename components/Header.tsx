import { useLocale } from '@/hooks/useLocale'
import { requestClosePanelSidebar } from '@/lib/panel_sidebar_notify'
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
 * Кнопка закрытия нужна потому, что панель занимает место поверх карты, а
 * закрыть её иначе можно только повторным кликом по кнопке расширения в
 * тулбаре — то есть уйти из панели, чтобы её убрать.
 *
 * Закрытие идёт через `requestClosePanelSidebar`: сайдбар живёт в DOM страницы
 * карты, а не в самой панели, поэтому панель просит background передать
 * сообщение на вкладку, и content script убирает контейнер. Напрямую убрать
 * родительский iframe страница расширения не может — она в другом документе.
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
          onClick={requestClosePanelSidebar}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </header>
  )
}
