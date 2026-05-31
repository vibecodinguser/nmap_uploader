import { Upload } from 'lucide-react'
import {
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { UploadStatus } from '@/hooks/useFileUpload'
import { ACCEPTED_FORMATS } from '@/lib/formats'

type PoligonTabProps = {
  isUploading: boolean
  progress: number
  uploadStatus: UploadStatus | null
  onUpload: (file: File) => void
}

const PROGRESS_RADIUS = 52
const PROGRESS_SIZE = 120
const PROGRESS_STROKE = 6
const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RADIUS

const statusClassName = (level: UploadStatus['level']) => {
  if (level === 'error') return 'upload-progress-status upload-progress-status--error'
  if (level === 'success') return 'upload-progress-status upload-progress-status--success'
  return 'upload-progress-status'
}

type UploadProgressRingProps = {
  progress: number
  isActive: boolean
}

function UploadProgressRing({ progress, isActive }: UploadProgressRingProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress))
  const strokeOffset = PROGRESS_CIRCUMFERENCE - (clampedProgress / 100) * PROGRESS_CIRCUMFERENCE

  return (
    <div
      className={isActive ? 'upload-progress-ring is-active' : 'upload-progress-ring'}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clampedProgress)}
      aria-label="Прогресс загрузки"
    >
      <svg
        className="upload-progress-svg"
        viewBox={`0 0 ${PROGRESS_SIZE} ${PROGRESS_SIZE}`}
        aria-hidden="true"
        focusable="false"
      >
        <g transform={`rotate(-90 ${PROGRESS_SIZE / 2} ${PROGRESS_SIZE / 2})`}>
          <circle
            className="upload-progress-track"
            cx={PROGRESS_SIZE / 2}
            cy={PROGRESS_SIZE / 2}
            r={PROGRESS_RADIUS}
            fill="none"
            strokeWidth={PROGRESS_STROKE}
          />
          <circle
            className="upload-progress-indicator"
            cx={PROGRESS_SIZE / 2}
            cy={PROGRESS_SIZE / 2}
            r={PROGRESS_RADIUS}
            fill="none"
            strokeWidth={PROGRESS_STROKE}
            strokeLinecap="round"
            strokeDasharray={PROGRESS_CIRCUMFERENCE}
            strokeDashoffset={strokeOffset}
          />
        </g>
      </svg>
      <span className="upload-progress-percent" aria-hidden="true">
        {Math.round(clampedProgress)}%
      </span>
    </div>
  )
}

export const PoligonTab = ({ isUploading, progress, uploadStatus, onUpload }: PoligonTabProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [hasUploadSession, setHasUploadSession] = useState(false)
  const showProgressUi = hasUploadSession || isUploading || uploadStatus !== null

  useEffect(() => {
    if (isUploading || uploadStatus) {
      setHasUploadSession(true)
    }
  }, [isUploading, uploadStatus])

  const handleFile = (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file) return
    setHasUploadSession(true)
    onUpload(file)
  }

  const handleDropzoneClick = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest('button')) return
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
      inputRef.current?.click()
    }
  }

  return (
    <div className="tab-panel">
      <form className="upload-form" onSubmit={(event) => event.preventDefault()}>
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

            {!isUploading && uploadStatus && (
              <p className={statusClassName(uploadStatus.level)}>{uploadStatus.message}</p>
            )}
          </div>
        )}
      </form>
    </div>
  )
}
