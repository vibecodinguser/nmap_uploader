import { useState } from 'react'
import '@/assets/styles/uploader.css'
import { Header } from '@/components/Header'
import { PointsTab } from '@/components/PointsTab'
import { UploadTab } from '@/components/UploadTab'
import { useAuth } from '@/hooks/useAuth'
import { useFileUpload } from '@/hooks/useFileUpload'
import { usePointUpload } from '@/hooks/usePointUpload'
import { useTheme } from '@/hooks/useTheme'

type AppProps = {
  themeTarget?: Element
}

type MainTab = 'upload' | 'manual'

export const App = ({ themeTarget }: AppProps) => {
  const { theme, toggleTheme } = useTheme(themeTarget)
  const { user, refreshUser, handleLogout } = useAuth()
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

  return (
    <div className="sidepanel-app">
      <Header theme={theme} user={user} onToggleTheme={toggleTheme} onLogout={handleLogout} />

      <main className="sidepanel-main">
        <div className="tabs" role="tablist" aria-label="Режим ввода">
          <button
            type="button"
            role="tab"
            className={activeTab === 'upload' ? 'tab-btn active' : 'tab-btn'}
            aria-selected={activeTab === 'upload'}
            onClick={() => setActiveTab('upload')}
          >
            Полигоны
          </button>
          <button
            type="button"
            role="tab"
            className={activeTab === 'manual' ? 'tab-btn active' : 'tab-btn'}
            aria-selected={activeTab === 'manual'}
            onClick={() => setActiveTab('manual')}
          >
            Точки
          </button>
        </div>

        {activeTab === 'upload' && (
          <UploadTab
            isUploading={isUploading}
            progress={progress}
            uploadStatus={uploadStatus}
            onUpload={performUpload}
          />
        )}

        {activeTab === 'manual' && (
          <PointsTab
            isUploading={isPointUploading}
            uploadStatus={pointUploadStatus}
            onManualUpload={performManualUpload}
            onMultipointUpload={performMultipointUpload}
          />
        )}
      </main>
    </div>
  )
}
