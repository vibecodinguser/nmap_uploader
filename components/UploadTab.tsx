import { Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { UploadStatus } from '../hooks/useFileUpload'
import type { Theme } from '../hooks/useTheme'
import { ACCEPTED_FORMATS } from '../lib/formats'

type UploadTabProps = {
  theme: Theme
  isUploading: boolean
  progress: number
  uploadStatus: UploadStatus | null
  onUpload: (file: File) => void
}

const PROGRESS_RADIUS = 52
const PROGRESS_SIZE = 120
const PROGRESS_STROKE = 6
const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RADIUS

const progressColors = (theme: Theme) => ({
  track: theme === 'dark' ? '#334155' : '#e2e8f0',
  indicator: theme === 'dark' ? '#f8fafc' : '#0f172a',
  text: theme === 'dark' ? '#f8fafc' : '#0f172a',
})

const statusClassName = (level: UploadStatus['level']) => {
  if (level === 'error') return 'upload-progress-status upload-progress-status--error'
  if (level === 'success') return 'upload-progress-status upload-progress-status--success'
  return 'upload-progress-status'
}

type UploadProgressRingProps = {
  theme: Theme
  progress: number
  isActive: boolean
}

const UploadProgressRing = ({ theme, progress, isActive }: UploadProgressRingProps) => {
  const colors = progressColors(theme)
  const clampedProgress = Math.min(100, Math.max(0, progress))
  const strokeOffset = PROGRESS_CIRCUMFERENCE - (clampedProgress / 100) * PROGRESS_CIRCUMFERENCE

  return (
    <div
      className={`upload-progress-ring${isActive ? ' is-active' : ''}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clampedProgress)}
      aria-label="Прогресс загрузки"
      style={{ position: 'relative', width: '7.5rem', height: '7.5rem', flexShrink: 0 }}
    >
      <svg
        viewBox={`0 0 ${PROGRESS_SIZE} ${PROGRESS_SIZE}`}
        aria-hidden="true"
        focusable="false"
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          transform: 'rotate(-90deg)',
        }}
      >
        <circle
          cx={PROGRESS_SIZE / 2}
          cy={PROGRESS_SIZE / 2}
          r={PROGRESS_RADIUS}
          fill="none"
          stroke={colors.track}
          strokeWidth={PROGRESS_STROKE}
        />
        <circle
          cx={PROGRESS_SIZE / 2}
          cy={PROGRESS_SIZE / 2}
          r={PROGRESS_RADIUS}
          fill="none"
          stroke={colors.indicator}
          strokeWidth={PROGRESS_STROKE}
          strokeLinecap="round"
          strokeDasharray={PROGRESS_CIRCUMFERENCE}
          strokeDashoffset={strokeOffset}
          style={{ transition: 'stroke-dashoffset 0.35s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      <span
        className="upload-progress-percent"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.125rem',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          color: colors.text,
        }}
      >
        {Math.round(clampedProgress)}%
      </span>
    </div>
  )
}

export const UploadTab = ({
  theme,
  isUploading,
  progress,
  uploadStatus,
  onUpload,
}: UploadTabProps) => {
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

  const handleDropzoneClick = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest('button')) return
    inputRef.current?.click()
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault()
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)
    handleFile(event.dataTransfer.files)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
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
          className={`upload-dropzone${isDragOver ? ' is-dragover' : ''}${isUploading ? ' is-uploading' : ''}`}
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
            или нажмите, чтобы выбрать файл на диске SHP, GPX, KML, KMZ, WKT, GeoJSON, TopoJSON
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
          <div
            className="upload-progress"
            aria-live="polite"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.875rem',
              width: '100%',
              padding: '0.25rem 0',
            }}
          >
            <UploadProgressRing theme={theme} progress={progress} isActive={isUploading} />

            {!isUploading && uploadStatus && (
              <p className={statusClassName(uploadStatus.level)}>{uploadStatus.message}</p>
            )}
          </div>
        )}
      </form>
    </div>
  )
}
