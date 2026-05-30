import {
  type ChangeEvent,
  type InputEvent,
  type SubmitEvent,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { PointUploadStatus } from '@/hooks/usePointUpload'

type PointSubTab = 'manual' | 'list'

type PointsTabProps = {
  isUploading: boolean
  uploadStatus: PointUploadStatus | null
  onManualUpload: (input: {
    description: string
    latitude: string
    longitude: string
    date: string
  }) => void
  onMultipointUpload: (input: { files: File[]; date: string }) => void
}

const statusClassName = (level: PointUploadStatus['level']) => {
  if (level === 'error') return 'upload-progress-status upload-progress-status--error'
  if (level === 'success') return 'upload-progress-status upload-progress-status--success'
  return 'upload-progress-status'
}

const adjustPointDescriptionHeight = (textarea: HTMLTextAreaElement) => {
  textarea.style.height = '1px'
  textarea.style.height = `${textarea.scrollHeight}px`
}

export const PointsTab = ({
  isUploading,
  uploadStatus,
  onManualUpload,
  onMultipointUpload,
}: PointsTabProps) => {
  const [activeSubTab, setActiveSubTab] = useState<PointSubTab>('manual')
  const [description, setDescription] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [manualDate, setManualDate] = useState('')
  const [listDate, setListDate] = useState('')
  const multipointInputRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    if (!descriptionRef.current) return
    adjustPointDescriptionHeight(descriptionRef.current)
  }, [description, activeSubTab])

  const handleDescriptionInput = (event: InputEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget
    setDescription(textarea.value)
    adjustPointDescriptionHeight(textarea)
  }

  const isManualSubmitDisabled = isUploading || !latitude.trim() || !longitude.trim()

  const handleManualSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isManualSubmitDisabled) return

    onManualUpload({
      description,
      latitude,
      longitude,
      date: manualDate,
    })
  }

  const handleMultipointPick = () => {
    multipointInputRef.current?.click()
  }

  const handleMultipointChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (selectedFiles.length === 0) return
    onMultipointUpload({ files: selectedFiles, date: listDate })
  }

  return (
    <div className="tab-panel points-tab">
      <div className="tabs point-tabs" role="tablist" aria-label="Режим добавления точек">
        <button
          type="button"
          role="tab"
          className={activeSubTab === 'manual' ? 'tab-btn active' : 'tab-btn'}
          aria-selected={activeSubTab === 'manual'}
          onClick={() => setActiveSubTab('manual')}
        >
          Ручное добавление
        </button>
        <button
          type="button"
          role="tab"
          className={activeSubTab === 'list' ? 'tab-btn active' : 'tab-btn'}
          aria-selected={activeSubTab === 'list'}
          onClick={() => setActiveSubTab('list')}
        >
          Загрузка списком
        </button>
      </div>

      {activeSubTab === 'manual' && (
        <section className="points-section" aria-label="Ручное добавление точки">
          <form className="manual-form points-form" onSubmit={handleManualSubmit}>
            <div className="manual-upload-container">
              <textarea
                ref={descriptionRef}
                id="point_description"
                className="point-description-input"
                name="description"
                rows={1}
                value={description}
                maxLength={150}
                placeholder="Описание (макс. 150 символов)"
                disabled={isUploading}
                onInput={handleDescriptionInput}
                aria-label="Описание точки"
              />

              <div className="coords-row coords-row--manual">
                <div className="coords-field coords-field--latitude">
                  <label htmlFor="point_latitude">Широта</label>
                  <input
                    type="number"
                    id="point_latitude"
                    name="latitude"
                    step="any"
                    value={latitude}
                    placeholder="55.12345"
                    required
                    disabled={isUploading}
                    onChange={(event) => setLatitude(event.target.value)}
                  />
                </div>
                <div className="coords-field coords-field--longitude">
                  <label htmlFor="point_longitude">Долгота</label>
                  <input
                    type="number"
                    id="point_longitude"
                    name="longitude"
                    step="any"
                    value={longitude}
                    placeholder="37.12345"
                    required
                    disabled={isUploading}
                    onChange={(event) => setLongitude(event.target.value)}
                  />
                </div>
                <div className="coords-field coords-field--date">
                  <label htmlFor="point_date">Дата</label>
                  <input
                    type="date"
                    id="point_date"
                    name="date"
                    value={manualDate}
                    disabled={isUploading}
                    onChange={(event) => setManualDate(event.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="submit-btn submit-btn--outline"
                disabled={isManualSubmitDisabled}
              >
                {isUploading ? 'Отправка…' : 'Загрузить'}
              </button>

              <blockquote className="points-section-subtitle">
                С помощью этой формы можно загрузить «заметку» в Блокнот картографа в виде точки с
                описанием.
              </blockquote>
            </div>
          </form>
        </section>
      )}

      {activeSubTab === 'list' && (
        <section className="points-section" aria-label="Загрузка точек списком">
          <div className="manual-upload-container">
            <div className="coords-row coords-row--list">
              <button
                type="button"
                className="submit-btn submit-btn--outline"
                disabled={isUploading}
                onClick={handleMultipointPick}
              >
                {isUploading ? 'Загрузка…' : 'Загрузить'}
              </button>
              <div className="coords-field coords-field--date">
                <label htmlFor="multipoint_date">Дата</label>
                <input
                  type="date"
                  id="multipoint_date"
                  name="date"
                  value={listDate}
                  disabled={isUploading}
                  onChange={(event) => setListDate(event.target.value)}
                />
              </div>
            </div>

            <input
              ref={multipointInputRef}
              type="file"
              accept=".txt"
              multiple
              hidden
              disabled={isUploading}
              onChange={handleMultipointChange}
            />

            <blockquote className="points-section-subtitle">
              Загрузите текстовый файл с точками в формате: "Название точки", 55.123456, 37.123456;
            </blockquote>
          </div>
        </section>
      )}

      {uploadStatus && (
        <p className={statusClassName(uploadStatus.level)} aria-live="polite">
          {uploadStatus.message}
        </p>
      )}
    </div>
  )
}
