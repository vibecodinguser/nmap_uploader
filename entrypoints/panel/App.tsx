import '@/assets/styles/uploader.css'
import { Header } from '@/components/Header'
import { SettingsTab } from '@/components/SettingsTab'
import { useAuth } from '@/hooks/useAuth'
import { useFeedsFilter } from '@/hooks/useFeedsFilter'
import { useGoToLinks } from '@/hooks/useGoToLinks'
import { useNotesButton } from '@/hooks/useNotesButton'
import { useReloadAfterUpload } from '@/hooks/useReloadAfterUpload'
import { useSplitViewButton } from '@/hooks/useSplitViewButton'
import { useStrokeColor } from '@/hooks/useStrokeColor'
import { useTheme } from '@/hooks/useTheme'

type AppProps = {
  themeTarget?: Element
}

export const App = ({ themeTarget }: AppProps) => {
  const { themeMode, setThemeMode } = useTheme(themeTarget)
  const strokeColor = useStrokeColor()
  const { user, avatarDataUrl, isLoggingIn, handleLogin, handleLogout } = useAuth()
  const reloadAfterUpload = useReloadAfterUpload(user?.id)
  const splitViewButton = useSplitViewButton()
  const notesButton = useNotesButton()
  const feedsFilter = useFeedsFilter()
  const goToLinks = useGoToLinks()

  const triggerLogin = async () => {
    await handleLogin()
  }

  return (
    <div className="sidepanel-app">
      <Header
        user={user}
        avatarDataUrl={avatarDataUrl}
        isLoggingIn={isLoggingIn}
        onLogin={triggerLogin}
        onLogout={handleLogout}
      />

      <main className="sidepanel-main">
        <SettingsTab
          themeMode={themeMode}
          onThemeModeChange={setThemeMode}
          strokeColor={strokeColor}
          reloadAfterUpload={reloadAfterUpload}
          splitViewButton={splitViewButton}
          notesButton={notesButton}
          feedsFilter={feedsFilter}
          goToLinks={goToLinks}
        />
      </main>
    </div>
  )
}
