import { ArrowLeft } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { GoToLinksSettings } from '@/components/GoToLinksSettings'
import { SettingsAboutSection } from '@/components/SettingsAboutSection'
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
import { FOCUS_NSPD_ACCESS_MESSAGE } from '@/lib/settings_popup/protocol'

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
  'isEnabled' | 'isLoaded' | 'setIsEnabled' | 'permissionDenied'
>

type NspdButtonSettings = Pick<
  ReturnType<typeof useNspdButton>,
  'isEnabled' | 'isLoaded' | 'setIsEnabled' | 'permissionDenied' | 'requestAccess'
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
  'isEnabled' | 'isLoaded' | 'setIsEnabled'
>

const SETTINGS_BACK_ICON_SIZE = 18

type SettingsTabProps = {
  onBack?: () => void
  strokeColor: StrokeColorSettingsProps
  reloadAfterUpload: ReloadAfterUploadSettings
  splitViewButton: SplitViewButtonSettings
  notesButton: NotesButtonSettings
  nspdButton: NspdButtonSettings
  /** Подсветить строку «Разрешить доступ» к НСПД после рендера. */
  focusNspdAccess?: boolean
  feedsFilter?: FeedsFilterSettings
  pointCounter?: PointCounterSettings
  objectTracker?: ObjectTrackerSettings
  goToLinks: GoToLinksSettingsState
}

export const SettingsTab = ({
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
  focusNspdAccess = false,
}: SettingsTabProps) => {
  const { t } = useLocale()
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
    permissionDenied: isNotesPermissionDenied,
  } = notesButton
  const {
    isEnabled: isNspdButtonEnabled,
    isLoaded: isNspdButtonLoaded,
    setIsEnabled: setNspdButtonEnabled,
    permissionDenied: isNspdPermissionDenied,
    requestAccess: requestNspdAccess,
  } = nspdButton

  const nspdGrantButtonRef = useRef<HTMLButtonElement>(null)
  /** Счётчик запросов подсветки из хоста попапа (попап уже был открыт). */
  const [nspdFocusRequest, setNspdFocusRequest] = useState(0)

  // Хост попапа просит подсветить доступ к НСПД: попап уже был открыт и
  // заново не собирался, поэтому параметр URL не сработал бы.
  useEffect(function subscribeNspdFocusMessage() {
    const handleMessage = (event: MessageEvent): void => {
      if (event.data?.action !== FOCUS_NSPD_ACCESS_MESSAGE) {
        return
      }
      setNspdFocusRequest((count) => count + 1)
    }
    window.addEventListener('message', handleMessage)
    return function cleanup() {
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  useEffect(
    function focusNspdGrantButtonEffect() {
      if (!focusNspdAccess || isNspdPermissionDenied !== 'nspd') {
        return
      }
      const button = nspdGrantButtonRef.current
      if (!button) {
        return
      }
      // `nspdFocusRequest` в зависимостях: хост может попросить подсветить
      // строку повторно, когда попап уже открыт и iframe заново не собирался.
      void nspdFocusRequest
      button.scrollIntoView({ block: 'center' })
      button.focus()
    },
    [focusNspdAccess, isNspdPermissionDenied, nspdFocusRequest],
  )

  const isFeedsFilterEnabled = feedsFilter?.isEnabled ?? false
  const isFeedsFilterLoaded = feedsFilter?.isLoaded ?? true
  const isFeedsFilterDisabled = !isFeedsFilterLoaded

  const isObjectTrackerEnabled = objectTracker?.isEnabled ?? false
  const isObjectTrackerLoaded = objectTracker?.isLoaded ?? true
  const isObjectTrackerDisabled = !isObjectTrackerLoaded

  const isPointCounterEnabled = pointCounter?.isEnabled ?? false
  const isPointCounterLoaded = pointCounter?.isLoaded ?? true
  const isPointCounterDisabled = !isPointCounterLoaded

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

      <SettingsGroupSection id="settings-editing" title={t('settings.editing')} defaultExpanded>
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
        >
          {isNotesPermissionDenied ? (
            <p className="settings-field-error" role="alert">
              {t('settings.yandexPermissionDenied')}
            </p>
          ) : null}
        </SettingsToggleRow>

        <SettingsToggleRow
          id="settings-nspd-button"
          variant="plain"
          title={t('settings.nspdButton')}
          ariaLabel={t('settings.nspdButtonAria')}
          checked={isNspdButtonEnabled}
          disabled={isNspdButtonDisabled}
          onChange={setNspdButtonEnabled}
        >
          {isNspdPermissionDenied === 'nspd' ? (
            <div className="settings-permission-hint">
              <p className="settings-field-error" role="alert">
                {t('settings.nspdPermissionDenied')}
              </p>
              <button
                ref={nspdGrantButtonRef}
                type="button"
                className="settings-grant-access-btn"
                onClick={requestNspdAccess}
              >
                {t('settings.grantNspdAccess')}
              </button>
            </div>
          ) : null}
          {isNspdPermissionDenied === 'yandex' ? (
            <p className="settings-field-error" role="alert">
              {t('settings.yandexPermissionDenied')}
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
        />
      </SettingsGroupSection>

      <SettingsGroupSection id="settings-style" title={t('settings.style')}>
        <StrokeColorSection {...strokeColor} variant="plain" />
      </SettingsGroupSection>

      <SettingsAboutSection />
    </div>
  )
}
