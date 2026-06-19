import type { YandexUser } from '@/lib/yandex/client';
import { LoginButton } from './LoginButton';
import { UserInfo } from './UserInfo';

type HeaderProps = {
  user: YandexUser | null;
  avatarDataUrl: string | null;
  isLoggingIn: boolean;
  onLogin: () => void;
  onLogout: () => void;
};

export const Header = ({ user, avatarDataUrl, isLoggingIn, onLogin, onLogout }: HeaderProps) => {
  let content;
  if (user) {
    content = <UserInfo user={user} avatarDataUrl={avatarDataUrl} onLogout={onLogout} />;
  } else {
    content = <LoginButton isLoggingIn={isLoggingIn} onLogin={onLogin} />;
  }

  return (
    <header className="sidepanel-header">
      <div className="header-container">{content}</div>
    </header>
  );
};
