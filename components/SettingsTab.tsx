import { ArrowLeft, Send } from 'lucide-react'
import { useMemo } from 'react'
import { GoToLinksSettings } from '@/components/GoToLinksSettings'
import { StrokeColorSection, type StrokeColorSettingsProps } from '@/components/StrokeColorSection'
import type { useFeedsFilter } from '@/hooks/useFeedsFilter'
import type { useGoToLinks } from '@/hooks/useGoToLinks'
import { useLocale } from '@/hooks/useLocale'
import type { useNotesButton } from '@/hooks/useNotesButton'
import type { useReloadAfterUpload } from '@/hooks/useReloadAfterUpload'
import type { useSplitViewButton } from '@/hooks/useSplitViewButton'
import type { ThemeMode } from '@/hooks/useTheme'
import { LOCALE_OPTIONS } from '@/lib/i18n/locale'
import type { Locale, LocaleOption } from '@/lib/i18n/locale.types'
import { RELEASES_URL } from '@/lib/releases_url'
import packageJson from '../package.json'

type ReloadAfterUploadSettings = Pick<
  ReturnType<typeof useReloadAfterUpload>,
  'isEnabled' | 'isLoaded' | 'setIsEnabled' | 'canChange'
>

type GoToLinksSettingsState = Pick<
  ReturnType<typeof useGoToLinks>,
  | 'isMenuEnabled'
  | 'items'
  | 'isLoaded'
  | 'setIsMenuEnabled'
  | 'setItemActive'
  | 'moveItemUp'
  | 'moveItemDown'
>

type SplitViewButtonSettings = Pick<
  ReturnType<typeof useSplitViewButton>,
  'isEnabled' | 'isLoaded' | 'setIsEnabled'
>

type NotesButtonSettings = Pick<
  ReturnType<typeof useNotesButton>,
  'isEnabled' | 'isLoaded' | 'setIsEnabled'
>

type FeedsFilterSettings = Pick<
  ReturnType<typeof useFeedsFilter>,
  'isEnabled' | 'isLoaded' | 'setIsEnabled'
>

const SETTINGS_BACK_ICON_SIZE = 18
const SETTINGS_FOOTER_ICON_SIZE = 16

type SettingsTabProps = {
  themeMode: ThemeMode
  onThemeModeChange: (mode: ThemeMode) => void
  onBack?: () => void
  strokeColor: StrokeColorSettingsProps
  reloadAfterUpload: ReloadAfterUploadSettings
  splitViewButton: SplitViewButtonSettings
  notesButton: NotesButtonSettings
  feedsFilter?: FeedsFilterSettings
  goToLinks: GoToLinksSettingsState
}

export const SettingsTab = ({
  themeMode,
  onThemeModeChange,
  onBack,
  strokeColor,
  reloadAfterUpload,
  splitViewButton,
  notesButton,
  feedsFilter,
  goToLinks,
}: SettingsTabProps) => {
  const { locale, setLocale, t } = useLocale()
  const {
    isEnabled: isReloadAfterUploadEnabled,
    isLoaded: isReloadAfterUploadLoaded,
    setIsEnabled: setReloadAfterUploadEnabled,
    canChange: canChangeReloadAfterUpload,
  } = reloadAfterUpload
  const {
    isEnabled: isSplitViewButtonEnabled,
    isLoaded: isSplitViewButtonLoaded,
    setIsEnabled: setSplitViewButtonEnabled,
  } = splitViewButton
  const {
    isEnabled: isNotesButtonEnabled,
    isLoaded: isNotesButtonLoaded,
    setIsEnabled: setNotesButtonEnabled,
  } = notesButton

  const isFeedsFilterEnabled = feedsFilter?.isEnabled ?? false
  const isFeedsFilterLoaded = feedsFilter?.isLoaded ?? true
  const isFeedsFilterDisabled = !isFeedsFilterLoaded

  const themeModeOptions = useMemo(
    () => [
      { value: 'dark' as const, label: t('settings.themeDark') },
      { value: 'light' as const, label: t('settings.themeLight') },
      { value: 'system' as const, label: t('settings.themeSystem') },
    ],
    [t],
  )

  const isSplitViewButtonDisabled = !isSplitViewButtonLoaded
  const isNotesButtonDisabled = !isNotesButtonLoaded
  const isReloadAfterUploadDisabled = !isReloadAfterUploadLoaded || !canChangeReloadAfterUpload

  return (
    <div className="tab-panel settings-tab">
      {onBack ? (
        <button
          type="button"
          className="settings-back-btn"
          onClick={onBack}
          aria-label={t('tabs.backToUploadAria')}
        >
          <ArrowLeft size={SETTINGS_BACK_ICON_SIZE} aria-hidden />
          <span>{t('common.back')}</span>
        </button>
      ) : null}

      <h2 className="settings-title">{t('settings.title')}</h2>

      <section className="settings-section" aria-labelledby="settings-language-heading">
        <h3 id="settings-language-heading" className="settings-section-title">
          {t('locale.label')}
        </h3>
        <div
          className="theme-mode-switch"
          role="radiogroup"
          aria-label={t('settings.languageAria')}
        >
          {LOCALE_OPTIONS.map((option: LocaleOption) => (
            <label key={option.value} className="theme-mode-switch-option">
              <input
                type="radio"
                name="locale"
                value={option.value}
                className="theme-mode-switch-input"
                checked={locale === option.value}
                onChange={(e) => setLocale(e.target.value as Locale)}
              />
              <span className="theme-mode-switch-label">{t(option.labelKey)}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-appearance-heading">
        <h3 id="settings-appearance-heading" className="settings-section-title">
          {t('settings.appearance')}
        </h3>
        <div className="theme-mode-switch" role="radiogroup" aria-label={t('settings.themeAria')}>
          {themeModeOptions.map((option) => (
            <label key={option.value} className="theme-mode-switch-option">
              <input
                type="radio"
                name="theme-mode"
                value={option.value}
                className="theme-mode-switch-input"
                checked={themeMode === option.value}
                onChange={(e) => onThemeModeChange(e.target.value as ThemeMode)}
              />
              <span className="theme-mode-switch-label">{option.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-split-view-heading">
        <div className="settings-toggle-row">
          <h3 id="settings-split-view-heading" className="settings-section-title">
            {t('settings.splitViewButton')}
          </h3>
          <label className="settings-toggle" htmlFor="settings-split-view-button">
            <input
              id="settings-split-view-button"
              type="checkbox"
              role="switch"
              className="settings-toggle-input"
              checked={isSplitViewButtonEnabled}
              aria-checked={isSplitViewButtonEnabled}
              disabled={isSplitViewButtonDisabled}
              aria-label={t('settings.splitViewAria')}
              onChange={(e) => setSplitViewButtonEnabled(e.target.checked)}
            />
            <span className="settings-toggle-track" aria-hidden="true">
              <span className="settings-toggle-thumb" />
            </span>
          </label>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-notes-button-heading">
        <div className="settings-toggle-row">
          <h3 id="settings-notes-button-heading" className="settings-section-title">
            {t('settings.notesButton')}
          </h3>
          <label className="settings-toggle" htmlFor="settings-notes-button">
            <input
              id="settings-notes-button"
              type="checkbox"
              role="switch"
              className="settings-toggle-input"
              checked={isNotesButtonEnabled}
              aria-checked={isNotesButtonEnabled}
              disabled={isNotesButtonDisabled}
              aria-label={t('settings.notesButtonAria')}
              onChange={(e) => setNotesButtonEnabled(e.target.checked)}
            />
            <span className="settings-toggle-track" aria-hidden="true">
              <span className="settings-toggle-thumb" />
            </span>
          </label>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-feeds-filter-heading">
        <div className="settings-toggle-row">
          <h3 id="settings-feeds-filter-heading" className="settings-section-title">
            {t('settings.feedsFilter')}
          </h3>
          <label className="settings-toggle" htmlFor="settings-feeds-filter-button">
            <input
              id="settings-feeds-filter-button"
              type="checkbox"
              role="switch"
              className="settings-toggle-input"
              checked={isFeedsFilterEnabled}
              aria-checked={isFeedsFilterEnabled}
              disabled={isFeedsFilterDisabled}
              aria-label={t('settings.feedsFilterAria')}
              onChange={(e) => feedsFilter?.setIsEnabled(e.target.checked)}
            />
            <span className="settings-toggle-track" aria-hidden="true">
              <span className="settings-toggle-thumb" />
            </span>
          </label>
        </div>
      </section>

      <GoToLinksSettings {...goToLinks} />

      <section className="settings-section" aria-labelledby="settings-upload-heading">
        <div className="settings-toggle-row">
          <h3 id="settings-upload-heading" className="settings-section-title">
            {t('settings.reloadAfterUpload')}
          </h3>
          <label className="settings-toggle" htmlFor="settings-reload-after-upload">
            <input
              id="settings-reload-after-upload"
              type="checkbox"
              role="switch"
              className="settings-toggle-input"
              checked={isReloadAfterUploadEnabled}
              aria-checked={isReloadAfterUploadEnabled}
              disabled={isReloadAfterUploadDisabled}
              aria-label={t('settings.reloadAfterUploadAria')}
              onChange={(e) => setReloadAfterUploadEnabled(e.target.checked)}
            />
            <span className="settings-toggle-track" aria-hidden="true">
              <span className="settings-toggle-thumb" />
            </span>
          </label>
        </div>
      </section>

      <StrokeColorSection {...strokeColor} />

      <section
        className="settings-section settings-section--about"
        aria-labelledby="settings-about-heading"
      >
        <h3 className="settings-section-title settings-section-title--row">
          <a
            id="settings-about-heading"
            href={RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="settings-about-link"
          >
            {t('common.version')} {packageJson.version}
          </a>
          <div className="footer-links">
            <a
              href="https://t.me/notebook_loader_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              <Send size={SETTINGS_FOOTER_ICON_SIZE} aria-hidden />
              @feedback
            </a>
          </div>
        </h3>
      </section>
    </div>
  )
}
