import { ChevronDown, ChevronUp } from 'lucide-react'
import { type ChangeEvent, memo } from 'react'
import type { useGoToLinks } from '@/hooks/useGoToLinks'
import { useLocale, useTranslate } from '@/hooks/useLocale'
import type { GoToItem } from '@/lib/go_to_settings'
import { getGoToSourceDisplayName, getGoToSourceIconUrl } from '@/lib/go_to_sources'

const GO_TO_CHEVRON_ICON_SIZE = 16

type GoToLinksSettingsItemProps = Readonly<{
  item: GoToItem
  index: number
  totalItems: number
  isLoaded: boolean
  setItemActive: ReturnType<typeof useGoToLinks>['setItemActive']
  moveItemUp: ReturnType<typeof useGoToLinks>['moveItemUp']
  moveItemDown: ReturnType<typeof useGoToLinks>['moveItemDown']
}>

function GoToLinksSettingsItemBase({
  item,
  index,
  totalItems,
  isLoaded,
  setItemActive,
  moveItemUp,
  moveItemDown,
}: GoToLinksSettingsItemProps) {
  const t = useTranslate()
  const { locale } = useLocale()
  const displayName = getGoToSourceDisplayName(item.name, locale)
  const iconUrl = getGoToSourceIconUrl(item.name)
  const isMoveUpEnabled = isLoaded && index > 0
  const isMoveDownEnabled = isLoaded && index < totalItems - 1

  const handleActiveChange = (event: ChangeEvent<HTMLInputElement>) => {
    setItemActive(item.name, event.target.checked)
  }

  const handleMoveUpClick = () => {
    moveItemUp(item.name)
  }

  const handleMoveDownClick = () => {
    moveItemDown(item.name)
  }

  return (
    <li className="settings-go-to-item">
      <div className="settings-go-to-item-label">
        <span
          className="settings-go-to-item-icon"
          style={{ backgroundImage: `url(${iconUrl})` }}
          aria-hidden
        />
        <span className="settings-go-to-item-name">{displayName}</span>
      </div>

      <label className="settings-toggle" htmlFor={`settings-go-to-item-${item.name}`}>
        <input
          id={`settings-go-to-item-${item.name}`}
          type="checkbox"
          role="switch"
          className="settings-toggle-input"
          checked={item.active}
          aria-checked={item.active}
          disabled={!isLoaded}
          aria-label={t('settings.showInMenuAria', { name: displayName })}
          onChange={handleActiveChange}
        />
        <span className="settings-toggle-track" aria-hidden="true">
          <span className="settings-toggle-thumb" />
        </span>
      </label>

      <div className="settings-go-to-item-actions">
        <button
          type="button"
          className="settings-go-to-move-btn"
          disabled={!isMoveUpEnabled}
          aria-label={t('settings.moveUpAria', { name: displayName })}
          onClick={handleMoveUpClick}
        >
          <ChevronUp size={GO_TO_CHEVRON_ICON_SIZE} aria-hidden />
        </button>
        <button
          type="button"
          className="settings-go-to-move-btn"
          disabled={!isMoveDownEnabled}
          aria-label={t('settings.moveDownAria', { name: displayName })}
          onClick={handleMoveDownClick}
        >
          <ChevronDown size={GO_TO_CHEVRON_ICON_SIZE} aria-hidden />
        </button>
      </div>
    </li>
  )
}

export const GoToLinksSettingsItem = memo(GoToLinksSettingsItemBase)
