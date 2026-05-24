import { useState } from 'react'
import { Header } from '../../components/Header'
import { ManualTab } from '../../components/ManualTab'
import { UploadTab } from '../../components/UploadTab'
import { useTheme } from '../../hooks/useTheme'

type TabId = 'upload' | 'manual'

type AppProps = {
  themeTarget?: Element
}

const App = ({ themeTarget }: AppProps) => {
  const { theme, toggleTheme } = useTheme(themeTarget)
  const [activeTab, setActiveTab] = useState<TabId>('upload')
  const [files, setFiles] = useState<File[]>([])
  const [pointName, setPointName] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canSubmit =
    activeTab === 'upload'
      ? files.length > 0
      : Boolean(pointName.trim() && latitude.trim() && longitude.trim())

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return

    setIsSubmitting(true)
    try {
      const payload =
        activeTab === 'upload'
          ? { type: 'upload' as const, files: files.map((f) => f.name) }
          : {
              type: 'manual' as const,
              pointName: pointName.trim(),
              latitude: latitude.trim(),
              longitude: longitude.trim(),
            }

      await browser.runtime.sendMessage({ action: 'submit', payload })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="sidepanel-app">
      <Header theme={theme} onToggleTheme={toggleTheme} />

      <main className="sidepanel-main">
        <div className="tabs" role="tablist" aria-label="Режим загрузки">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'upload'}
            className={`tab-btn${activeTab === 'upload' ? ' active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            Полигоны
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'manual'}
            className={`tab-btn${activeTab === 'manual' ? ' active' : ''}`}
            onClick={() => setActiveTab('manual')}
          >
            Точки
          </button>
        </div>

        {activeTab === 'upload' ? (
          <UploadTab files={files} onFilesChange={setFiles} />
        ) : (
          <ManualTab
            pointName={pointName}
            latitude={latitude}
            longitude={longitude}
            onPointNameChange={setPointName}
            onLatitudeChange={setLatitude}
            onLongitudeChange={setLongitude}
          />
        )}
      </main>

      <footer className="sidepanel-footer">
        <button
          type="button"
          className="submit-btn"
          disabled={!canSubmit || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? 'Отправка…' : 'Отправить'}
        </button>
      </footer>
    </div>
  )
}

export default App
