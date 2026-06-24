import { Settings } from 'lucide-react'
import { useMemo, useState } from 'react'
import { TabBar } from '@/components/TabBar'
import '@/assets/styles/uploader.css'
import { Header } from '@/components/Header'
import { NotesTab } from '@/components/NotesTab'
import { PoligonTab } from '@/components/PoligonTab'
import { SettingsTab } from '@/components/SettingsTab'
import { useAuth } from '@/hooks/useAuth'
import { useFileUpload } from '@/hooks/useFileUpload'
import { useGoToLinks } from '@/hooks/useGoToLinks'
import { useLocale } from '@/hooks/useLocale'
import { OccupiedDatesProvider } from '@/hooks/useOccupiedDates'
import { usePointUpload } from '@/hooks/usePointUpload'
import { useReloadAfterUpload } from '@/hooks/useReloadAfterUpload'
import { useSplitViewButton } from '@/hooks/useSplitViewButton'
import { useStrokeColor } from '@/hooks/useStrokeColor'
import { useTheme } from '@/hooks/useTheme'

type AppProps = {
  themeTarget?: Element
}

type MainTab = 'upload' | 'notes'
type AppView = 'main' | 'settings'

export const App = ({ themeTarget }: AppProps) => {
  const { t } = useLocale()
  const { themeMode, setThemeMode } = useTheme(themeTarget)
  const strokeColor = useStrokeColor()
  const { user, avatarDataUrl, isLoggingIn, isLoggedIn, refreshUser, handleLogin, handleLogout } =
    useAuth()
  const reloadAfterUpload = useReloadAfterUpload(user?.id)
  const splitViewButton = useSplitViewButton()
  const goToLinks = useGoToLinks()
  const { isUploading, progress, uploadStatus, performUpload } = useFileUpload({
    onAuthenticated: refreshUser,
  })
  const { isUploading: isPointUploading, performManualUpload } = usePointUpload({
    onAuthenticated: refreshUser,
  })
  const [activeTab, setActiveTab] = useState<MainTab>('upload')
  const [activeView, setActiveView] = useState<AppView>('main')

  const mainTabs = useMemo(
    function buildMainTabs() {
      return [
        { id: 'upload' as const, label: t('tabs.polygons') },
        { id: 'notes' as const, label: 'Заметки' },
      ]
    },
    [t],
  )

  const handleOpenSettings = () => {
    setActiveView('settings')
  }

  const handleCloseSettings = () => {
    setActiveView('main')
  }

  const triggerLogin = async () => {
    await handleLogin()
  }

  const handleRequireAuth = async () => {
    if (!isLoggingIn) {
      await triggerLogin()
    }
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
        <OccupiedDatesProvider isLoggedIn={isLoggedIn}>
          {activeView === 'settings' && (
            <SettingsTab
              themeMode={themeMode}
              onThemeModeChange={setThemeMode}
              onBack={handleCloseSettings}
              strokeColor={strokeColor}
              reloadAfterUpload={reloadAfterUpload}
              splitViewButton={splitViewButton}
              goToLinks={goToLinks}
            />
          )}

          {activeView === 'main' && (
            <>
              <TabBar
                tabs={mainTabs}
                activeId={activeTab}
                onChange={setActiveTab}
                ariaLabel={t('tabs.inputModeAria')}
              />

              {activeTab === 'upload' && (
                <PoligonTab
                  isUploading={isUploading}
                  progress={progress}
                  uploadStatus={uploadStatus}
                  isLoggedIn={isLoggedIn}
                  onRequireAuth={handleRequireAuth}
                  onUpload={performUpload}
                />
              )}

              {activeTab === 'notes' && (
                <NotesTab
                  isUploading={isPointUploading}
                  isLoggedIn={isLoggedIn}
                  onRequireAuth={handleRequireAuth}
                  onManualUpload={performManualUpload}
                />
              )}
            </>
          )}
        </OccupiedDatesProvider>
      </main>

      {activeView === 'main' && (
        <button
          type="button"
          className="settings-nav-btn"
          onClick={handleOpenSettings}
          aria-label={t('tabs.openSettingsAria')}
        >
          <Settings size={18} aria-hidden />
          <span>{t('common.settings')}</span>
        </button>
      )}
    </div>
  )
}
