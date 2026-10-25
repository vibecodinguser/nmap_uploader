import { ArrowLeft } from 'lucide-react'
import { useMemo } from 'react'
import { GoToLinksSettings } from '@/components/GoToLinksSettings'
import { SegmentedRadioGroup } from '@/components/SegmentedRadioGroup'
import { SettingsAboutSection } from '@/components/SettingsAboutSection'
import { SettingsToggleRow } from '@/components/SettingsToggleRow'
import { StrokeColorSection, type StrokeColorSettingsProps } from '@/components/StrokeColorSection'
import type { useFeedsFilter } from '@/hooks/useFeedsFilter'
import type { useGoToLinks } from '@/hooks/useGoToLinks'
import { useLocale } from '@/hooks/useLocale'
import type { useNotesButton } from '@/hooks/useNotesButton'
import type { useReloadAfterUpload } from '@/hooks/useReloadAfterUpload'
import type { useSplitViewButton } from '@/hooks/useSplitViewButton'
import type { ThemeMode } from '@/hooks/useTheme'
import { LOCALE_OPTIONS } from '@/lib/i18n/locale'

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

  const localeOptions = useMemo(
    () =>
      LOCALE_OPTIONS.map((opt) => ({
        value: opt.value,
        label: t(opt.labelKey),
      })),
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
        <SegmentedRadioGroup
          name="locale"
          ariaLabel={t('settings.languageAria')}
          value={locale}
          options={localeOptions}
          onChange={setLocale}
        />
      </section>

      <section className="settings-section" aria-labelledby="settings-appearance-heading">
        <h3 id="settings-appearance-heading" className="settings-section-title">
          {t('settings.appearance')}
        </h3>
        <SegmentedRadioGroup
          name="theme-mode"
          ariaLabel={t('settings.themeAria')}
          value={themeMode}
          options={themeModeOptions}
          onChange={onThemeModeChange}
        />
      </section>

      <SettingsToggleRow
        id="settings-split-view-button"
        title={t('settings.splitViewButton')}
        ariaLabel={t('settings.splitViewAria')}
        checked={isSplitViewButtonEnabled}
        disabled={isSplitViewButtonDisabled}
        onChange={setSplitViewButtonEnabled}
      />

      <SettingsToggleRow
        id="settings-notes-button"
        title={t('settings.notesButton')}
        ariaLabel={t('settings.notesButtonAria')}
        checked={isNotesButtonEnabled}
        disabled={isNotesButtonDisabled}
        onChange={setNotesButtonEnabled}
      />

      <SettingsToggleRow
        id="settings-feeds-filter-button"
        title={t('settings.feedsFilter')}
        ariaLabel={t('settings.feedsFilterAria')}
        checked={isFeedsFilterEnabled}
        disabled={isFeedsFilterDisabled}
        onChange={(checked) => feedsFilter?.setIsEnabled(checked)}
      />

      <GoToLinksSettings {...goToLinks} />

      <SettingsToggleRow
        id="settings-reload-after-upload"
        title={t('settings.reloadAfterUpload')}
        ariaLabel={t('settings.reloadAfterUploadAria')}
        checked={isReloadAfterUploadEnabled}
        disabled={isReloadAfterUploadDisabled}
        onChange={setReloadAfterUploadEnabled}
      />

      <StrokeColorSection {...strokeColor} />

      <SettingsAboutSection />
    </div>
  )
}
