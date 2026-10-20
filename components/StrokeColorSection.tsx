import { type ChangeEvent, type KeyboardEvent, memo } from 'react'
import { useTranslate } from '@/hooks/useLocale'
import type { useStrokeColor } from '@/hooks/useStrokeColor'
import { DEFAULT_STROKE_COLOR_INPUT, toStrokeColorInputValue } from '@/lib/stroke_color'

export type StrokeColorSettingsProps = Pick<
  ReturnType<typeof useStrokeColor>,
  | 'inputValue'
  | 'effectiveColor'
  | 'validationError'
  | 'applyStatus'
  | 'isLoaded'
  | 'isApplying'
  | 'canApply'
  | 'handleInputChange'
  | 'handleApply'
>

export const StrokeColorSection = memo(
  ({
    inputValue,
    effectiveColor,
    validationError,
    applyStatus,
    isLoaded,
    isApplying,
    canApply,
    handleInputChange,
    handleApply,
  }: StrokeColorSettingsProps) => {
    const t = useTranslate()

    const isStrokeColorDisabled = !isLoaded || isApplying
    const isApplyDisabled = !canApply
    const hasValidationError = Boolean(validationError)
    const colorInputGroupClassName = hasValidationError
      ? 'settings-color-input-group settings-color-input-group--invalid'
      : 'settings-color-input-group'

    const onColorPickerChange = (value: string) => {
      const normalizedValue = toStrokeColorInputValue(value)
      handleInputChange(normalizedValue)
    }

    const onColorPickerInputChange = (event: ChangeEvent<HTMLInputElement>) => {
      onColorPickerChange(event.target.value)
    }

    const onStrokeColorInputChange = (event: ChangeEvent<HTMLInputElement>) => {
      onColorPickerChange(event.target.value)
    }

    const onApplyClick = () => {
      handleApply().catch((error) => {
        console.warn('[nmap_uploader] stroke color apply failed:', error)
      })
    }

    const onStrokeColorInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        if (canApply) {
          onApplyClick()
        }
      }
    }

    return (
      <section className="settings-section" aria-labelledby="settings-path-heading">
        <h3 id="settings-path-heading" className="settings-section-title">
          {t('settings.strokeColor')}
        </h3>
        <div className="settings-field">
          <div className="settings-color-field">
            <input
              type="color"
              className="settings-color-picker"
              value={effectiveColor}
              disabled={isStrokeColorDisabled}
              aria-label={t('settings.pickStrokeColorAria')}
              onChange={onColorPickerInputChange}
            />
            <div className={colorInputGroupClassName}>
              <span className="settings-color-prefix" aria-hidden>
                #
              </span>
              <input
                id="stroke-color-input"
                type="text"
                className="settings-color-input"
                value={inputValue}
                placeholder={DEFAULT_STROKE_COLOR_INPUT}
                disabled={isStrokeColorDisabled}
                aria-label={t('settings.strokeColor')}
                aria-invalid={hasValidationError ? true : undefined}
                aria-describedby="stroke-color-hint stroke-color-error"
                onChange={onStrokeColorInputChange}
                onKeyDown={onStrokeColorInputKeyDown}
              />
            </div>
            <button
              type="button"
              className="submit-btn--outline settings-apply-btn"
              disabled={isApplyDisabled}
              onClick={onApplyClick}
            >
              {isApplying ? '…' : t('common.apply')}
            </button>
          </div>

          {validationError && (
            <p id="stroke-color-error" className="settings-field-error" role="alert">
              {validationError}
            </p>
          )}
          {applyStatus === 'success' && (
            <p className="settings-field-success" role="status">
              {t('settings.strokeColorApplied')}
            </p>
          )}
          {applyStatus === 'error' && (
            <p className="settings-field-error" role="alert">
              {t('settings.strokeColorApplyError')}
            </p>
          )}
        </div>
      </section>
    )
  },
)
