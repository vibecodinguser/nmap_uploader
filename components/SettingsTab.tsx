import { ArrowLeft } from 'lucide-react'
import type { useReloadAfterUpload } from '@/hooks/useReloadAfterUpload'
import type { useStrokeColor } from '@/hooks/useStrokeColor'
import type { ThemeMode } from '@/hooks/useTheme'
import { DEFAULT_STROKE_COLOR_INPUT } from '@/lib/stroke_color'

type StrokeColorSettings = Pick<
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

const THEME_MODE_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'dark', label: 'Тёмная тема' },
  { value: 'light', label: 'Светлая тема' },
  { value: 'system', label: 'Авто' },
]

type ReloadAfterUploadSettings = Pick<
  ReturnType<typeof useReloadAfterUpload>,
  'isEnabled' | 'isLoaded' | 'setIsEnabled' | 'canChange'
>

type SettingsTabProps = {
  themeMode: ThemeMode
  onThemeModeChange: (mode: ThemeMode) => void
  onBack: () => void
  strokeColor: StrokeColorSettings
  reloadAfterUpload: ReloadAfterUploadSettings
}

export const SettingsTab = ({
  themeMode,
  onThemeModeChange,
  onBack,
  strokeColor,
  reloadAfterUpload,
}: SettingsTabProps) => {
  const {
    inputValue,
    effectiveColor,
    validationError,
    applyStatus,
    isLoaded,
    isApplying,
    canApply,
    handleInputChange,
    handleApply,
  } = strokeColor
  const {
    isEnabled: isReloadAfterUploadEnabled,
    isLoaded: isReloadAfterUploadLoaded,
    setIsEnabled: setReloadAfterUploadEnabled,
    canChange: canChangeReloadAfterUpload,
  } = reloadAfterUpload

  const handleApplyClick = () => {
    handleApply().catch((error: unknown) => {
      console.warn('[nmap_uploader] stroke color apply failed:', error)
    })
  }

  const handleColorPickerChange = (value: string) => {
    handleInputChange(value.replace(/^#/, ''))
  }

  return (
    <div className="tab-panel settings-tab">
      <button
        type="button"
        className="settings-back-btn"
        onClick={onBack}
        aria-label="Назад к загрузке"
      >
        <ArrowLeft size={18} aria-hidden />
        <span>Назад</span>
      </button>

      <h2 className="settings-title">Настройки</h2>

      <section className="settings-section" aria-labelledby="settings-path-heading">
        <h3 id="settings-path-heading" className="settings-section-title">
          Контур
        </h3>
        <div className="settings-field">
          <div className="settings-color-field">
            <input
              type="color"
              className="settings-color-picker"
              value={effectiveColor}
              disabled={!isLoaded || isApplying}
              aria-label="Выбрать цвет контура"
              onChange={(event) => handleColorPickerChange(event.target.value)}
            />
            <div
              className={
                validationError
                  ? 'settings-color-input-group settings-color-input-group--invalid'
                  : 'settings-color-input-group'
              }
            >
              <span className="settings-color-prefix" aria-hidden>
                #
              </span>
              <input
                id="stroke-color-input"
                type="text"
                className="settings-color-input"
                value={inputValue}
                placeholder={DEFAULT_STROKE_COLOR_INPUT}
                disabled={!isLoaded || isApplying}
                aria-invalid={validationError ? true : undefined}
                aria-describedby="stroke-color-hint stroke-color-error"
                onChange={(event) => handleInputChange(event.target.value.replace(/^#/, ''))}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  if (!canApply) return
                  handleApplyClick()
                }}
              />
            </div>
            <button
              type="button"
              className="submit-btn submit-btn--outline settings-apply-btn"
              disabled={!canApply}
              onClick={handleApplyClick}
            >
              {isApplying ? '…' : 'Применить'}
            </button>
          </div>

          {validationError ? (
            <p id="stroke-color-error" className="settings-field-error" role="alert">
              {validationError}
            </p>
          ) : null}
          {applyStatus === 'success' ? (
            <p className="settings-field-success" role="status">
              Цвет контура применён
            </p>
          ) : null}
          {applyStatus === 'error' ? (
            <p className="settings-field-error" role="alert">
              Не удалось применить цвет. Обновите страницу карты и попробуйте снова.
            </p>
          ) : null}
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-upload-heading">
        <h3 id="settings-upload-heading" className="settings-section-title">
          Загрузка
        </h3>
        <label className="settings-checkbox">
          <input
            type="checkbox"
            className="settings-checkbox-input"
            checked={isReloadAfterUploadEnabled}
            disabled={!isReloadAfterUploadLoaded || !canChangeReloadAfterUpload}
            onChange={(event) => setReloadAfterUploadEnabled(event.target.checked)}
          />
          <span className="settings-checkbox-label">Перезагрузить страницу после загрузки</span>
        </label>
      </section>

      <section className="settings-section" aria-labelledby="settings-appearance-heading">
        <h3 id="settings-appearance-heading" className="settings-section-title">
          Оформление
        </h3>
        <div className="theme-mode-switch" role="radiogroup" aria-label="Тема оформления">
          {THEME_MODE_OPTIONS.map((option) => (
            <label key={option.value} className="theme-mode-switch-option">
              <input
                type="radio"
                name="theme-mode"
                value={option.value}
                className="theme-mode-switch-input"
                checked={themeMode === option.value}
                onChange={() => onThemeModeChange(option.value)}
              />
              <span className="theme-mode-switch-label">{option.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-about-heading">
        <h3 id="settings-about-heading" className="settings-section-title">
          О приложении
        </h3>
        <dl className="settings-about-list">
          <div className="settings-about-item">
            <dt>Версия</dt>
            <dd>1.1</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
