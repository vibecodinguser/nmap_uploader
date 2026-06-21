import { LogOut } from 'lucide-react'
import { useTranslate } from '@/hooks/useLocale'
import type { YandexUser } from '@/lib/yandex/client'

type UserInfoProps = {
  user: YandexUser
  avatarDataUrl: string | null
  onLogout: () => void
}

export const UserInfo = ({ user, avatarDataUrl, onLogout }: UserInfoProps) => {
  const t = useTranslate()
  const displayName = user.displayName || user.realName || user.login

  return (
    <div className="user-info">
      {avatarDataUrl && (
        <img
          src={avatarDataUrl}
          alt=""
          className="nk-user-bar-view__user-icon"
          width={40}
          height={40}
          decoding="async"
        />
      )}
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
  )
}
