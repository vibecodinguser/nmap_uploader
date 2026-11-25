import '@/assets/styles/uploader.css'
import { Header } from '@/components/Header'
import { SettingsTab } from '@/components/SettingsTab'
import { useAuth } from '@/hooks/useAuth'
import { useFeedsFilter } from '@/hooks/useFeedsFilter'
import { useGoToLinks } from '@/hooks/useGoToLinks'
import { useNotesButton } from '@/hooks/useNotesButton'
import { useNspdButton } from '@/hooks/useNspdButton'
import { useObjectTracker } from '@/hooks/useObjectTracker'
import { usePointCounter } from '@/hooks/usePointCounter'
import { useReloadAfterUpload } from '@/hooks/useReloadAfterUpload'
import { useSplitViewButton } from '@/hooks/useSplitViewButton'
import { useStrokeColor } from '@/hooks/useStrokeColor'
import {
  SETTINGS_POPUP_FOCUS_NSPD,
  SETTINGS_POPUP_FOCUS_QUERY_PARAM,
} from '@/lib/settings_popup/protocol'

export const App = () => {
  const strokeColor = useStrokeColor()
  const { user, avatarDataUrl, isLoggingIn, handleLogin, handleLogout } = useAuth()
  const reloadAfterUpload = useReloadAfterUpload(user?.id)
  const splitViewButton = useSplitViewButton()
  const notesButton = useNotesButton()
  const nspdButton = useNspdButton()
  const feedsFilter = useFeedsFilter()
  const pointCounter = usePointCounter()
  const objectTracker = useObjectTracker()
  const goToLinks = useGoToLinks()

  // Попап открыт кнопкой НСПД без доступа: подсветить строку «Разрешить доступ».
  const focusNspdAccess =
    new URLSearchParams(window.location.search).get(SETTINGS_POPUP_FOCUS_QUERY_PARAM) ===
    SETTINGS_POPUP_FOCUS_NSPD

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
          strokeColor={strokeColor}
          reloadAfterUpload={reloadAfterUpload}
          splitViewButton={splitViewButton}
          notesButton={notesButton}
          nspdButton={nspdButton}
          focusNspdAccess={focusNspdAccess}
          feedsFilter={feedsFilter}
          pointCounter={pointCounter}
          objectTracker={objectTracker}
          goToLinks={goToLinks}
        />
      </main>
    </div>
  )
}
