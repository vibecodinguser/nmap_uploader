import { Settings } from 'lucide-react'
import { useState } from 'react'
import { TabBar } from '@/components/TabBar'
import '@/assets/styles/uploader.css'
import { Header } from '@/components/Header'
import { PointsTab } from '@/components/PointsTab'
import { PoligonTab } from '@/components/PoligonTab'
import { SettingsTab } from '@/components/SettingsTab'
import { useAuth } from '@/hooks/useAuth'
import { useFileUpload } from '@/hooks/useFileUpload'
import { useGoToLinks } from '@/hooks/useGoToLinks'
import { OccupiedDatesProvider } from '@/hooks/useOccupiedDates'
import { usePointUpload } from '@/hooks/usePointUpload'
import { useReloadAfterUpload } from '@/hooks/useReloadAfterUpload'
import { useSplitViewButton } from '@/hooks/useSplitViewButton'
import { useStrokeColor } from '@/hooks/useStrokeColor'
import { useTheme } from '@/hooks/useTheme'

type AppProps = {
  themeTarget?: Element
}

type MainTab = 'upload' | 'manual'
type AppView = 'main' | 'settings'

const MAIN_TABS: { id: MainTab; label: string }[] = [
  { id: 'upload', label: 'Полигоны' },
  { id: 'manual', label: 'Точки' },
]

export const App = ({ themeTarget }: AppProps) => {
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
  const {
    isUploading: isPointUploading,
    uploadStatus: pointUploadStatus,
    performManualUpload,
    performMultipointUpload,
  } = usePointUpload({ onAuthenticated: refreshUser })
  const [activeTab, setActiveTab] = useState<MainTab>('upload')
  const [activeView, setActiveView] = useState<AppView>('main')

  const handleOpenSettings = () => {
    setActiveView('settings')
  }

  const handleCloseSettings = () => {
    setActiveView('main')
  }

  const handleLoginClick = () => {
    void handleLogin()
  }

  const handleRequireAuth = () => {
    if (isLoggingIn) return
    handleLoginClick()
  }

  return (
    <div className="sidepanel-app">
      <Header
        user={user}
        avatarDataUrl={avatarDataUrl}
        isLoggingIn={isLoggingIn}
        onLogin={handleLoginClick}
        onLogout={handleLogout}
      />

      <main className="sidepanel-main">
        <OccupiedDatesProvider isLoggedIn={isLoggedIn}>
          {activeView === 'settings' ? (
            <SettingsTab
              themeMode={themeMode}
              onThemeModeChange={setThemeMode}
              onBack={handleCloseSettings}
              strokeColor={strokeColor}
              reloadAfterUpload={reloadAfterUpload}
              splitViewButton={splitViewButton}
              goToLinks={goToLinks}
            />
          ) : (
            <>
              <TabBar
                tabs={MAIN_TABS}
                activeId={activeTab}
                onChange={setActiveTab}
                ariaLabel="Режим ввода"
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

              {activeTab === 'manual' && (
                <PointsTab
                  isUploading={isPointUploading}
                  uploadStatus={pointUploadStatus}
                  isLoggedIn={isLoggedIn}
                  onRequireAuth={handleRequireAuth}
                  onManualUpload={performManualUpload}
                  onMultipointUpload={performMultipointUpload}
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
          aria-label="Открыть настройки"
        >
          <Settings size={18} aria-hidden />
          <span>Настройки</span>
        </button>
      )}
    </div>
  )
}
