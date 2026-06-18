import { Upload } from 'lucide-react'
import {
  type DragEvent,
  type MouseEvent,
  useEffect,
  useRef,
  useState,
} from 'react'
import { PointDateField } from '@/components/PointDateField'
import { UploadProgressRing } from '@/components/UploadProgressRing'
import { UploadStatusMessage } from '@/components/UploadStatusMessage'
import type { UploadStatus } from '@/hooks/useFileUpload'
import { useTranslate } from '@/hooks/useLocale'
import { ACCEPTED_FORMATS } from '@/lib/formats'
import { requireAuthBeforeAction } from '@/lib/require_auth'

type PoligonTabProps = {
  isUploading: boolean
  progress: number
  uploadStatus: UploadStatus | null
  isLoggedIn: boolean
  onRequireAuth: () => void
  onUpload: (input: { file: File; date: string }) => void
}

export const PoligonTab = ({
  isUploading,
  progress,
  uploadStatus,
  isLoggedIn,
  onRequireAuth,
  onUpload,
}: PoligonTabProps) => {
  const t = useTranslate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [polygonDate, setPolygonDate] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [hasUploadSession, setHasUploadSession] = useState(false)
  const showProgressUi = hasUploadSession || isUploading || uploadStatus !== null

  useEffect(() => {
    if (isUploading || uploadStatus) {
      setHasUploadSession(true)
    }
  }, [isUploading, uploadStatus])

  const ensureAuthenticated = (): boolean => requireAuthBeforeAction({ isLoggedIn, onRequireAuth })

  const handleFile = (fileList: FileList | null) => {
    if (!ensureAuthenticated()) return
    const file = fileList?.[0]
    if (!file) return
    setHasUploadSession(true)
    onUpload({ file, date: polygonDate })
  }

  const handleDropzoneClick = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest('button')) return
    if (!ensureAuthenticated()) return
    inputRef.current?.click()
  }

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (event: DragEvent) => {
    event.preventDefault()
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }

  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)
    handleFile(event.dataTransfer.files)
  }

  const dropzoneClassName = (() => {
    if (isDragOver && isUploading) return 'upload-dropzone is-dragover is-uploading'
    if (isDragOver) return 'upload-dropzone is-dragover'
    if (isUploading) return 'upload-dropzone is-uploading'
    return 'upload-dropzone'
  })()

  return (
    <div className="tab-panel">
      <form className="upload-form" onSubmit={(event) => event.preventDefault()}>
        <div className="coords-row coords-row--polygon">
          <PointDateField
            id="polygon_date"
            value={polygonDate}
            disabled={isUploading}
            centerPlaceholderWithButton
            onChange={setPolygonDate}
          />
        </div>

        <div
          className={dropzoneClassName}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleDropzoneClick}
          aria-busy={isUploading}
        >
          <Upload className="upload-dropzone-icon" aria-hidden />
          <p className="upload-dropzone-title">{t('upload.dropzoneTitle')}</p>
          <p className="upload-dropzone-subtitle">
            {t('upload.dropzoneSubtitleLine1')} <br /> {t('upload.dropzoneSubtitleLine2')}
          </p>
          <br />
          <button
            type="button"
            className="submit-btn submit-btn--inline"
            disabled={isUploading}
            onClick={(event) => {
              event.stopPropagation()
              if (!ensureAuthenticated()) return
              inputRef.current?.click()
            }}
          >
            {isUploading ? t('common.uploading') : t('upload.chooseFile')}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_FORMATS}
            hidden
            disabled={isUploading}
            aria-label={t('upload.chooseFile')}
            onChange={(event) => {
              handleFile(event.target.files)
              event.target.value = ''
            }}
          />
        </div>

        {showProgressUi && (
          <div className="upload-progress" aria-live="polite">
            <UploadProgressRing progress={progress} isActive={isUploading} />

            {!isUploading && uploadStatus ? <UploadStatusMessage status={uploadStatus} /> : null}
          </div>
        )}
      </form>
    </div>
  )
}
