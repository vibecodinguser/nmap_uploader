import { Upload } from 'lucide-react'
import {
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useRef,
  useState,
} from 'react'
import { PointDateField } from '@/components/PointDateField'
import { UploadProgressRing } from '@/components/UploadProgressRing'
import { UploadStatusMessage } from '@/components/UploadStatusMessage'
import type { UploadStatus } from '@/hooks/useFileUpload'
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

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!ensureAuthenticated()) return
      inputRef.current?.click()
    }
  }

  return (
    <div className="tab-panel">
      <form className="upload-form" onSubmit={(event) => event.preventDefault()}>
        <div className="coords-row coords-row--polygon">
          <PointDateField
            id="polygon_date"
            value={polygonDate}
            disabled={isUploading}
            onChange={setPolygonDate}
          />
        </div>

        {/* biome-ignore lint/a11y/useSemanticElements: dropzone contains inner button */}
        <div
          role="button"
          tabIndex={0}
          className={dropzoneClassName}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleDropzoneClick}
          onKeyDown={handleKeyDown}
          aria-label="Зона загрузки файлов"
          aria-busy={isUploading}
        >
          <Upload className="upload-dropzone-icon" aria-hidden />
          <p className="upload-dropzone-title">Перетащите файлы сюда</p>
          <p className="upload-dropzone-subtitle">
            или нажмите, чтобы выбрать файл на диске: <br /> SHP, GPX, KML, KMZ, WKT, GeoJSON,
            TopoJSON
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
            {isUploading ? 'Загрузка…' : 'Выбрать файл'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_FORMATS}
            hidden
            disabled={isUploading}
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
