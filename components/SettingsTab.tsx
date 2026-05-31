import { ArrowLeft, Moon, Sun } from 'lucide-react'
import type { Theme } from '@/hooks/useTheme'
import type { useStrokeColor } from '@/hooks/useStrokeColor'
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

type SettingsTabProps = {
  theme: Theme
  onToggleTheme: () => void
  onBack: () => void
  strokeColor: StrokeColorSettings
}

export const SettingsTab = ({
  theme,
  onToggleTheme,
  onBack,
  strokeColor,
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

  const handleApplyClick = () => {
    handleApply().catch((error: unknown) => {
      console.warn('[nmap_uploader] stroke color apply failed:', error)
    })
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

      <section className="settings-section" aria-labelledby="settings-map-heading">
        <h3 id="settings-map-heading" className="settings-section-title">
        Цвет контура
        </h3>
        <div className="settings-field">
          <div className="settings-color-field">
            <span
              className="settings-color-preview"
              style={{ backgroundColor: effectiveColor }}
              aria-hidden
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
          <p id="stroke-color-hint" className="settings-row-hint">
            Пустое значение — {DEFAULT_STROKE_COLOR_INPUT} по умолчанию. Контур виден при
            выделении объекта на карте; после смены цвета выделите объект заново.
          </p>
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

      <section className="settings-section" aria-labelledby="settings-appearance-heading">
        <h3 id="settings-appearance-heading" className="settings-section-title">
          Оформление
        </h3>
        <div className="settings-row">
          <div className="settings-row-text">
            <span className="settings-row-label">Тема</span>
            <span className="settings-row-hint">
              {theme === 'dark' ? 'Тёмная' : 'Светлая'}
            </span>
          </div>
          <button
            type="button"
            className="btn-theme-toggle"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-about-heading">
        <h3 id="settings-about-heading" className="settings-section-title">
          О приложении
        </h3>
        <dl className="settings-about-list">
          <div className="settings-about-item">
            <dt>Название</dt>
            <dd>nmap_uploader</dd>
          </div>
          <div className="settings-about-item">
            <dt>Версия</dt>
            <dd>0.1.0</dd>
          </div>
          <div className="settings-about-item">
            <dt>Назначение</dt>
            <dd>Загрузчик в Блокнот картографа Народной карты</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
