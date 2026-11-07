import { ArrowLeft } from 'lucide-react'
import { useMemo } from 'react'
import { GoToLinksSettings } from '@/components/GoToLinksSettings'
import { SegmentedRadioGroup } from '@/components/SegmentedRadioGroup'
import { SettingsAboutSection } from '@/components/SettingsAboutSection'
import { SettingsFieldRow } from '@/components/SettingsFieldRow'
import { SettingsGroupSection } from '@/components/SettingsGroupSection'
import { SettingsToggleRow } from '@/components/SettingsToggleRow'
import { StrokeColorSection, type StrokeColorSettingsProps } from '@/components/StrokeColorSection'
import type { useFeedsFilter } from '@/hooks/useFeedsFilter'
import type { useGoToLinks } from '@/hooks/useGoToLinks'
import { useLocale } from '@/hooks/useLocale'
import type { useNotesButton } from '@/hooks/useNotesButton'
import type { useNspdButton } from '@/hooks/useNspdButton'
import type { useObjectTracker } from '@/hooks/useObjectTracker'
import type { usePointCounter } from '@/hooks/usePointCounter'
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

type NspdButtonSettings = Pick<
  ReturnType<typeof useNspdButton>,
  'isEnabled' | 'isLoaded' | 'setIsEnabled' | 'permissionDenied'
>

type FeedsFilterSettings = Pick<
  ReturnType<typeof useFeedsFilter>,
  'isEnabled' | 'isLoaded' | 'setIsEnabled'
>

type PointCounterSettings = Pick<
  ReturnType<typeof usePointCounter>,
  'isEnabled' | 'isLoaded' | 'setIsEnabled'
>

type ObjectTrackerSettings = Pick<
  ReturnType<typeof useObjectTracker>,
  'isEnabled' | 'isLoaded' | 'intervalMinutes' | 'setIsEnabled' | 'setIntervalMinutes'
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
  nspdButton: NspdButtonSettings
  feedsFilter?: FeedsFilterSettings
  pointCounter?: PointCounterSettings
  objectTracker?: ObjectTrackerSettings
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
  nspdButton,
  feedsFilter,
  pointCounter,
  objectTracker,
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
  const {
    isEnabled: isNspdButtonEnabled,
    isLoaded: isNspdButtonLoaded,
    setIsEnabled: setNspdButtonEnabled,
    permissionDenied: isNspdPermissionDenied,
  } = nspdButton

  const isFeedsFilterEnabled = feedsFilter?.isEnabled ?? false
  const isFeedsFilterLoaded = feedsFilter?.isLoaded ?? true
  const isFeedsFilterDisabled = !isFeedsFilterLoaded

  const isObjectTrackerEnabled = objectTracker?.isEnabled ?? false
  const isObjectTrackerLoaded = objectTracker?.isLoaded ?? true
  const isObjectTrackerDisabled = !isObjectTrackerLoaded
  const objectTrackerInterval = String(objectTracker?.intervalMinutes ?? 30)
  const objectTrackerIntervalOptions = useMemo(
    () => [
      { value: '5', label: '5 мин' },
      { value: '15', label: '15 мин' },
      { value: '30', label: '30 мин' },
      { value: '60', label: '60 мин' },
    ],
    [],
  )

  const isPointCounterEnabled = pointCounter?.isEnabled ?? true
  const isPointCounterLoaded = pointCounter?.isLoaded ?? true
  const isPointCounterDisabled = !isPointCounterLoaded

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
  const isNspdButtonDisabled = !isNspdButtonLoaded
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

      <SettingsGroupSection id="settings-general" title={t('settings.general')} defaultExpanded>
        <SettingsFieldRow id="settings-language" title={t('locale.label')}>
          <SegmentedRadioGroup
            name="locale"
            ariaLabel={t('settings.languageAria')}
            value={locale}
            options={localeOptions}
            onChange={setLocale}
          />
        </SettingsFieldRow>

        <SettingsFieldRow id="settings-appearance" title={t('settings.appearance')}>
          <SegmentedRadioGroup
            name="theme-mode"
            ariaLabel={t('settings.themeAria')}
            value={themeMode}
            options={themeModeOptions}
            onChange={onThemeModeChange}
          />
        </SettingsFieldRow>
      </SettingsGroupSection>

      <SettingsGroupSection id="settings-editing" title={t('settings.editing')}>
        <SettingsToggleRow
          id="settings-split-view-button"
          variant="plain"
          title={t('settings.splitViewButton')}
          ariaLabel={t('settings.splitViewAria')}
          checked={isSplitViewButtonEnabled}
          disabled={isSplitViewButtonDisabled}
          onChange={setSplitViewButtonEnabled}
        />

        <SettingsToggleRow
          id="settings-notes-button"
          variant="plain"
          title={t('settings.notesButton')}
          ariaLabel={t('settings.notesButtonAria')}
          checked={isNotesButtonEnabled}
          disabled={isNotesButtonDisabled}
          onChange={setNotesButtonEnabled}
        />

        <SettingsToggleRow
          id="settings-nspd-button"
          variant="plain"
          title={t('settings.nspdButton')}
          ariaLabel={t('settings.nspdButtonAria')}
          checked={isNspdButtonEnabled}
          disabled={isNspdButtonDisabled}
          onChange={setNspdButtonEnabled}
        >
          {isNspdPermissionDenied ? (
            <p className="settings-field-error" role="alert">
              {t('settings.nspdPermissionDenied')}
            </p>
          ) : null}
        </SettingsToggleRow>

        <GoToLinksSettings {...goToLinks} variant="plain" />

        <SettingsToggleRow
          id="settings-point-counter"
          variant="plain"
          title={t('settings.pointCounter')}
          ariaLabel={t('settings.pointCounterAria')}
          checked={isPointCounterEnabled}
          disabled={isPointCounterDisabled}
          onChange={(checked) => pointCounter?.setIsEnabled(checked)}
        />

        <SettingsToggleRow
          id="settings-reload-after-upload"
          variant="plain"
          title={t('settings.reloadAfterUpload')}
          ariaLabel={t('settings.reloadAfterUploadAria')}
          checked={isReloadAfterUploadEnabled}
          disabled={isReloadAfterUploadDisabled}
          onChange={setReloadAfterUploadEnabled}
        />
      </SettingsGroupSection>

      <SettingsGroupSection id="settings-moderation" title={t('settings.moderation')}>
        <SettingsToggleRow
          id="settings-feeds-filter-button"
          variant="plain"
          title={t('settings.feedsFilter')}
          ariaLabel={t('settings.feedsFilterAria')}
          checked={isFeedsFilterEnabled}
          disabled={isFeedsFilterDisabled}
          onChange={(checked) => feedsFilter?.setIsEnabled(checked)}
        />

        <SettingsToggleRow
          id="settings-object-tracker"
          variant="plain"
          title={t('settings.objectTracker')}
          ariaLabel={t('settings.objectTrackerAria')}
          checked={isObjectTrackerEnabled}
          disabled={isObjectTrackerDisabled}
          onChange={(checked) => objectTracker?.setIsEnabled(checked)}
        >
          {isObjectTrackerEnabled ? (
            <div className="settings-object-tracker-interval">
              <span className="settings-object-tracker-interval-label">
                {t('settings.objectTrackerInterval')}
              </span>
              <SegmentedRadioGroup
                name="object-tracker-interval"
                ariaLabel={t('settings.objectTrackerIntervalAria')}
                value={objectTrackerInterval}
                options={objectTrackerIntervalOptions}
                onChange={(value) => objectTracker?.setIntervalMinutes(Number(value))}
              />
            </div>
          ) : null}
        </SettingsToggleRow>
      </SettingsGroupSection>

      <SettingsGroupSection id="settings-style" title={t('settings.style')}>
        <StrokeColorSection {...strokeColor} variant="plain" />
      </SettingsGroupSection>

      <SettingsAboutSection />
    </div>
  )
}
