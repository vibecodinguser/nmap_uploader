import type { ChangeEvent, SubmitEvent } from 'react'
import { PointDateField } from '@/components/PointDateField'
import { POINT_DESCRIPTION_MAX_LENGTH } from '@/lib/point_uploader'

type ManualPointUploadProps = {
  isUploading: boolean
  description: string
  latitude: string
  longitude: string
  manualDate: string
  isManualSubmitDisabled: boolean
  manualSubmitButtonText: string
  manualHint: string
  latitudeLabel: string
  longitudeLabel: string
  descriptionPlaceholder: string
  descriptionAriaLabel: string
  sectionAriaLabel: string
  onDescriptionChange: (event: ChangeEvent<HTMLTextAreaElement>) => void
  onLatitudeChange: (event: ChangeEvent<HTMLInputElement>) => void
  onLongitudeChange: (event: ChangeEvent<HTMLInputElement>) => void
  onManualDateChange: (date: string) => void
  onManualSubmit: (event: SubmitEvent<HTMLFormElement>) => void
}

function manualPointUpload({
  isUploading,
  description,
  latitude,
  longitude,
  manualDate,
  isManualSubmitDisabled,
  manualSubmitButtonText,
  manualHint,
  latitudeLabel,
  longitudeLabel,
  descriptionPlaceholder,
  descriptionAriaLabel,
  sectionAriaLabel,
  onDescriptionChange,
  onLatitudeChange,
  onLongitudeChange,
  onManualDateChange,
  onManualSubmit,
}: ManualPointUploadProps) {
  return (
    <section className="points-section" aria-label={sectionAriaLabel}>
      <form className="manual-form points-form" onSubmit={onManualSubmit}>
        <div className="manual-upload-container">
          <textarea
            id="point_description"
            className="point-description-input"
            name="description"
            rows={1}
            value={description}
            maxLength={POINT_DESCRIPTION_MAX_LENGTH}
            placeholder={descriptionPlaceholder}
            disabled={isUploading}
            onChange={onDescriptionChange}
            aria-label={descriptionAriaLabel}
          />

          <div className="coords-row--manual">
            <PointDateField
              id="point_date"
              value={manualDate}
              disabled={isUploading}
              onChange={onManualDateChange}
            />
            <div className="coords-field">
              <label htmlFor="point_latitude">{latitudeLabel}</label>
              <input
                type="number"
                id="point_latitude"
                name="latitude"
                step="any"
                value={latitude}
                placeholder="55.12345"
                required
                disabled={isUploading}
                onChange={onLatitudeChange}
              />
            </div>
            <div className="coords-field">
              <label htmlFor="point_longitude">{longitudeLabel}</label>
              <input
                type="number"
                id="point_longitude"
                name="longitude"
                step="any"
                value={longitude}
                placeholder="37.12345"
                required
                disabled={isUploading}
                onChange={onLongitudeChange}
              />
            </div>
          </div>

          <button type="submit" className="submit-btn--outline" disabled={isManualSubmitDisabled}>
            {manualSubmitButtonText}
          </button>

          <p className="points-section-subtitle">{manualHint}</p>
        </div>
      </form>
    </section>
  )
}

export const ManualPointUpload = manualPointUpload
