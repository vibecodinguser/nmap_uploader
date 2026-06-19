import { LogIn } from 'lucide-react';
import { useTranslate } from '@/hooks/useLocale';

type LoginButtonProps = {
  isLoggingIn: boolean;
  onLogin: () => void;
};

export const LoginButton = ({ isLoggingIn, onLogin }: LoginButtonProps) => {
  const t = useTranslate();
  let loginButtonText;
  if (isLoggingIn) {
    loginButtonText = t('header.loggingIn');
  } else {
    loginButtonText = t('header.login');
  }

  return (
    <button
      type="button"
      className="header-login-btn"
      onClick={onLogin}
      disabled={isLoggingIn}
      aria-busy={isLoggingIn}
      aria-label={t('header.loginAria')}
    >
      <LogIn size={16} aria-hidden />
      <span className="nk-user-bar-view__login">{loginButtonText}</span>
    </button>
  );
};
