import { Upload } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

const ACCEPTED_FORMATS = '.shp,.gpx,.kml,.kmz,.wkt,.geojson,.json,.topojson'

type UploadTabProps = {
  files: File[]
  onFilesChange: (files: File[]) => void
}

export const UploadTab = ({ files, onFilesChange }: UploadTabProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList?.length) return
      onFilesChange([...files, ...Array.from(fileList)])
    },
    [files, onFilesChange],
  )

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => setIsDragOver(false)

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(false)
    handleFiles(event.dataTransfer.files)
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
          className={`upload-dropzone${isDragOver ? ' is-dragover' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          onKeyDown={handleKeyDown}
          aria-label="Зона загрузки файлов"
        >
          <Upload className="upload-dropzone-icon" aria-hidden />
          <p className="upload-dropzone-title">
            Перетащите файлы сюда или нажмите, чтобы выбрать файл на диске
          </p>
          <p className="upload-dropzone-formats">SHP, GPX, KML, KMZ, WKT, GeoJSON, TopoJSON</p>
          <button
            type="button"
            className="submit-btn submit-btn--inline"
            onClick={(event) => {
              event.stopPropagation()
              inputRef.current?.click()
            }}
          >
            Выбрать файл
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_FORMATS}
            multiple
            hidden
            onChange={(event) => {
              handleFiles(event.target.files)
              event.target.value = ''
            }}
          />
        </div>
        {files.length > 0 && (
          <ul className="manual-hint" aria-live="polite">
            {files.map((file) => (
              <li key={`${file.name}-${file.size}`}>{file.name}</li>
            ))}
          </ul>
        )}
      </form>
    </div>
  )
}
