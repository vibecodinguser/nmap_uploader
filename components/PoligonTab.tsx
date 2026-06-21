import { Upload } from 'lucide-react'
import {
  type ChangeEvent,
  type DragEvent,
  type MouseEvent,
  type ReactNode,
  type SubmitEvent,
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

function getDropzoneClassName(isDragOver: boolean, isUploading: boolean): string {
  const parts = ['upload-dropzone']
  if (isDragOver) {
    parts.push('is-dragover')
  }
  if (isUploading) {
    parts.push('is-uploading')
  }
  return parts.join(' ')
}

function getChooseFileButtonText(isUploading: boolean, t: ReturnType<typeof useTranslate>): string {
  let text: string
  if (isUploading) {
    text = t('common.uploading')
  } else {
    text = t('upload.chooseFile')
  }
  return text
}

function getUploadStatusMessage(
  isUploading: boolean,
  uploadStatus: UploadStatus | null,
): ReactNode {
  let message: ReactNode = null
  if (!isUploading && uploadStatus) {
    message = <UploadStatusMessage status={uploadStatus} />
  }
  return message
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
  const dropzoneClassName = getDropzoneClassName(isDragOver, isUploading)
  const chooseFileButtonText = getChooseFileButtonText(isUploading, t)
  const uploadStatusMessage = getUploadStatusMessage(isUploading, uploadStatus)

  useEffect(
    function trackUploadSession(): void {
      if (isUploading || uploadStatus) {
        setHasUploadSession(true)
      }
    },
    [isUploading, uploadStatus],
  )

  const ensureAuthenticated = function ensureAuthenticated(): boolean {
    return requireAuthBeforeAction({ isLoggedIn, onRequireAuth })
  }

  const handleFile = function handleFile(fileList: FileList | null): void {
    if (ensureAuthenticated()) {
      const file = fileList?.[0]
      if (file) {
        setHasUploadSession(true)
        onUpload({ file, date: polygonDate })
      }
    }
  }

  const handleFileInputActivate = function handleFileInputActivate(event: MouseEvent): void {
    if (!ensureAuthenticated()) {
      event.preventDefault()
    }
  }

  const handleDragOver = function handleDragOver(event: DragEvent): void {
    event.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = function handleDragLeave(event: DragEvent): void {
    event.preventDefault()
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }

  const handleDrop = function handleDrop(event: DragEvent): void {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)
    handleFile(event.dataTransfer.files)
  }

  const handleFormSubmit = function handleFormSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault()
  }

  const handleFileInputChange = function handleFileInputChange(
    event: ChangeEvent<HTMLInputElement>,
  ): void {
    handleFile(event.target.files)
    event.target.value = ''
  }

  return (
    <div className="tab-panel">
      <form className="upload-form" onSubmit={handleFormSubmit}>
        <div className="coords-row--polygon">
          <PointDateField
            id="polygon_date"
            value={polygonDate}
            disabled={isUploading}
            centerPlaceholderWithButton
            onChange={setPolygonDate}
          />
        </div>

        <label
          className={dropzoneClassName}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          aria-busy={isUploading}
        >
          <Upload className="upload-dropzone-icon" aria-hidden />
          <p className="upload-dropzone-title">{t('upload.dropzoneTitle')}</p>
          <p className="upload-dropzone-subtitle">
            {t('upload.dropzoneSubtitleLine1')} <br /> {t('upload.dropzoneSubtitleLine2')}
          </p>
          <br />
          <span className="submit-btn--inline" aria-hidden="true">
            {chooseFileButtonText}
          </span>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_FORMATS}
            hidden
            disabled={isUploading}
            aria-label={t('upload.chooseFile')}
            onClick={handleFileInputActivate}
            onChange={handleFileInputChange}
          />
        </label>

        {showProgressUi && (
          <div className="upload-progress" aria-live="polite">
            <UploadProgressRing progress={progress} isActive={isUploading} />
            {uploadStatusMessage}
          </div>
        )}
      </form>
    </div>
  )
}
