import { type ChangeEvent, type SubmitEvent, useRef, useState } from 'react'
import { PointDateField } from '@/components/PointDateField'
import { TabBar } from '@/components/TabBar'
import { UploadStatusMessage } from '@/components/UploadStatusMessage'
import type { PointUploadStatus } from '@/hooks/usePointUpload'
import { requireAuthBeforeAction } from '@/lib/require_auth'

type PointSubTab = 'manual' | 'list'

const POINT_SUB_TABS: { id: PointSubTab; label: string }[] = [
  { id: 'manual', label: 'Ручное добавление' },
  { id: 'list', label: 'Загрузка списком' },
]

type PointsTabProps = {
  isUploading: boolean
  uploadStatus: PointUploadStatus | null
  isLoggedIn: boolean
  onRequireAuth: () => void
  onManualUpload: (input: {
    description: string
    latitude: string
    longitude: string
    date: string
  }) => void
  onMultipointUpload: (input: { files: File[]; date: string }) => void
}

export const PointsTab = ({
  isUploading,
  uploadStatus,
  isLoggedIn,
  onRequireAuth,
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

  const isManualSubmitDisabled = isUploading || !latitude.trim() || !longitude.trim()

  const ensureAuthenticated = (): boolean => requireAuthBeforeAction({ isLoggedIn, onRequireAuth })

  const handleManualSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isManualSubmitDisabled) return
    if (!ensureAuthenticated()) return

    onManualUpload({
      description,
      latitude,
      longitude,
      date: manualDate,
    })
  }

  const handleMultipointPick = () => {
    if (!ensureAuthenticated()) return
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
      <TabBar
        tabs={POINT_SUB_TABS}
        activeId={activeSubTab}
        onChange={setActiveSubTab}
        ariaLabel="Режим добавления точек"
        className="tabs point-tabs"
      />

      {activeSubTab === 'manual' && (
        <section className="points-section" aria-label="Ручное добавление точки">
          <form className="manual-form points-form" onSubmit={handleManualSubmit}>
            <div className="manual-upload-container">
              <textarea
                id="point_description"
                className="point-description-input"
                name="description"
                rows={1}
                value={description}
                maxLength={150}
                placeholder="Описание добавляемой точки (макс. 150 символов)"
                disabled={isUploading}
                onChange={(event) => setDescription(event.currentTarget.value)}
                aria-label="Описание точки"
              />

              <div className="coords-row coords-row--manual">
                <PointDateField
                  id="point_date"
                  value={manualDate}
                  disabled={isUploading}
                  onChange={setManualDate}
                />
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
              <PointDateField
                id="multipoint_date"
                value={listDate}
                disabled={isUploading}
                onChange={setListDate}
              />
              <button
                type="button"
                className="submit-btn submit-btn--outline"
                disabled={isUploading}
                onClick={handleMultipointPick}
              >
                {isUploading ? 'Загрузка…' : 'Загрузить'}
              </button>
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

      {uploadStatus ? <UploadStatusMessage status={uploadStatus} /> : null}
    </div>
  )
}
