import { PoligonTab } from '@/components/PoligonTab'
import { useAuth } from '@/hooks/useAuth'
import { useFileUpload } from '@/hooks/useFileUpload'
import { OccupiedDatesProvider } from '@/hooks/useOccupiedDates'

export const PolygonUploadApp = () => {
  const { isLoggingIn, isLoggedIn, refreshUser, handleLogin } = useAuth()
  const { isUploading, progress, uploadStatus, performUpload } = useFileUpload({
    onAuthenticated: refreshUser,
  })

  const handleRequireAuth = async (): Promise<void> => {
    if (!isLoggingIn) {
      await handleLogin()
    }
  }

  return (
    <main className="polygon-upload-popup-app" data-testid="polygon-upload-view">
      <OccupiedDatesProvider isLoggedIn={isLoggedIn}>
        <PoligonTab
          isUploading={isUploading}
          progress={progress}
          uploadStatus={uploadStatus}
          isLoggedIn={isLoggedIn}
          onRequireAuth={handleRequireAuth}
          onUpload={performUpload}
        />
      </OccupiedDatesProvider>
    </main>
  )
}
