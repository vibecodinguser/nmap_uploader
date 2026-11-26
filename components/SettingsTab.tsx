import { useEffect, useRef, useState } from 'react'
import { GoToLinksSettings } from '@/components/GoToLinksSettings'
import { SettingsAboutSection } from '@/components/SettingsAboutSection'
import { SettingsTabBar, type SettingsTabDescriptor } from '@/components/SettingsTabBar'
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
  | 'moveItemBy'
  | 'reorderItems'
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

type SettingsTabProps = {
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

  const tabs: readonly SettingsTabDescriptor[] = [
    { id: 'editing', label: t('settings.editing') },
    { id: 'moderation', label: t('settings.moderation') },
    { id: 'style', label: t('settings.style') },
  ]

  // Активная вкладка не запоминается: попап собирается заново при каждом
  // открытии, и каждый раз начинается с «Редактирования».
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? 'editing')
  const nspdGrantButtonRef = useRef<HTMLButtonElement>(null)
  /** Счётчик запросов подсветки доступа к НСПД: параметр URL, сообщение хоста. */
  const [nspdFocusRequest, setNspdFocusRequest] = useState(0)
  /** Какой запрос подсветки уже обработан: повторный рендер не должен драться за фокус. */
  const handledNspdFocusRef = useRef(0)

  // Открытие по параметру URL просит подсветку один раз; если хост попросит
  // позже (попап уже открыт), счётчик увеличит обработчик сообщения.
  useEffect(
    function requestFocusFromProp() {
      if (focusNspdAccess) {
        setNspdFocusRequest((count) => count + 1)
      }
    },
    [focusNspdAccess],
  )

  useEffect(function subscribeNspdFocusMessage() {
    const handleMessage = (event: MessageEvent): void => {
      if (event.data?.action !== FOCUS_NSPD_ACCESS_MESSAGE) {
        return
      }
      setActiveTab('editing')
      setNspdFocusRequest((count) => count + 1)
    }
    window.addEventListener('message', handleMessage)
    return function cleanup() {
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  // Строка «Разрешить доступ» живёт во вкладке «Редактирование»: сначала
  // переключаем вкладку, затем (после её монтирования) скроллим и фокусируем.
  // Состояние разрешения приходит асинхронно, поэтому без `nspd` запрос не
  // закрываем — эффект вернётся, когда оно догрузится.
  useEffect(
    function focusNspdGrantButtonEffect() {
      if (nspdFocusRequest === 0 || nspdFocusRequest === handledNspdFocusRef.current) {
        return
      }
      if (activeTab !== 'editing') {
        setActiveTab('editing')
        return
      }
      if (isNspdPermissionDenied !== 'nspd') {
        return
      }
      const button = nspdGrantButtonRef.current
      if (!button) {
        return
      }
      handledNspdFocusRef.current = nspdFocusRequest
      button.scrollIntoView({ block: 'center' })
      button.focus()
    },
    [nspdFocusRequest, activeTab, isNspdPermissionDenied],
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

  const editingPanel = (
    <>
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
    </>
  )

  const moderationPanel = (
    <>
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
    </>
  )

  const stylePanel = <StrokeColorSection {...strokeColor} variant="plain" />

  const panelContent =
    activeTab === 'moderation' ? moderationPanel : activeTab === 'style' ? stylePanel : editingPanel

  return (
    <div className="tab-panel settings-tab">
      <SettingsTabBar
        tabs={tabs}
        activeId={activeTab}
        ariaLabel={t('settings.sectionsAria')}
        onChange={setActiveTab}
      />

      {/* `key` пересоздаёт панель: прокрутка новой вкладки начинается с начала. */}
      <div
        key={activeTab}
        id={`settings-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`settings-tab-${activeTab}`}
        className="settings-tab__panel"
      >
        <div className="settings-toggle-group">{panelContent}</div>
      </div>

      <SettingsAboutSection />
    </div>
  )
}
