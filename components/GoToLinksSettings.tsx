import { ChevronRight } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { GoToLinksSettingsItem } from '@/components/GoToLinksSettingsItem'
import { SettingsToggleRow } from '@/components/SettingsToggleRow'
import type { useGoToLinks } from '@/hooks/useGoToLinks'
import { useTranslate } from '@/hooks/useLocale'
import type { GoToItem } from '@/lib/go_to_settings'

const GO_TO_CHEVRON_ICON_SIZE = 16

function isActiveGoToItem(item: GoToItem): boolean {
  return item.active
}

function getToggledListExpanded(isExpanded: boolean): boolean {
  return !isExpanded
}

function getGoToToggleIconClassName(isExpanded: boolean): string | undefined {
  let className: string | undefined
  if (isExpanded) {
    className = 'settings-go-to-toggle-icon--expanded'
  }
  return className
}

type GoToLinksSettingsProps = Pick<
  ReturnType<typeof useGoToLinks>,
  | 'isMenuEnabled'
  | 'items'
  | 'isLoaded'
  | 'setIsMenuEnabled'
  | 'setItemActive'
  | 'moveItemUp'
  | 'moveItemDown'
>

type GoToLinksListRenderContext = {
  totalItems: number
  isLoaded: boolean
  setItemActive: GoToLinksSettingsProps['setItemActive']
  moveItemUp: GoToLinksSettingsProps['moveItemUp']
  moveItemDown: GoToLinksSettingsProps['moveItemDown']
}

type ExpandedGoToListProps = {
  isListExpanded: boolean
  items: GoToItem[]
  listContext: GoToLinksListRenderContext
  listHint: string
  listAriaLabel: string
}

function buildGoToLinksListItems(
  items: GoToItem[],
  context: GoToLinksListRenderContext,
): ReactNode[] {
  const renderedItems: ReactNode[] = []
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    renderedItems.push(
      <GoToLinksSettingsItem
        key={item.name}
        item={item}
        index={index}
        totalItems={context.totalItems}
        isLoaded={context.isLoaded}
        setItemActive={context.setItemActive}
        moveItemUp={context.moveItemUp}
        moveItemDown={context.moveItemDown}
      />,
    )
  }
  return renderedItems
}

function renderExpandedGoToList(props: ExpandedGoToListProps) {
  let panel: ReactNode = null
  if (props.isListExpanded) {
    const listItems = buildGoToLinksListItems(props.items, props.listContext)
    panel = (
      <div id="settings-go-to-list" className="settings-go-to-panel">
        <p className="settings-go-to-hint">{props.listHint}</p>

        <ul className="settings-go-to-list" aria-label={props.listAriaLabel}>
          {listItems}
        </ul>
      </div>
    )
  }
  return panel
}

export const GoToLinksSettings = ({
  isMenuEnabled,
  items,
  isLoaded,
  setIsMenuEnabled,
  setItemActive,
  moveItemUp,
  moveItemDown,
}: GoToLinksSettingsProps) => {
  const t = useTranslate()
  const [isListExpanded, setIsListExpanded] = useState(false)
  const activeCount = items.filter(isActiveGoToItem).length

  const handleToggleList = () => {
    setIsListExpanded(getToggledListExpanded)
  }

  const listContext: GoToLinksListRenderContext = {
    totalItems: items.length,
    isLoaded,
    setItemActive,
    moveItemUp,
    moveItemDown,
  }

  return (
    <SettingsToggleRow
      id="settings-go-to-menu-enabled"
      title={t('settings.goToButton')}
      ariaLabel={t('settings.showButtonAria')}
      checked={isMenuEnabled}
      disabled={!isLoaded}
      onChange={setIsMenuEnabled}
    >
      <button
        type="button"
        className="settings-go-to-toggle"
        aria-expanded={isListExpanded}
        aria-controls="settings-go-to-list"
        disabled={!isLoaded}
        onClick={handleToggleList}
      >
        <ChevronRight
          size={GO_TO_CHEVRON_ICON_SIZE}
          aria-hidden
          className={getGoToToggleIconClassName(isListExpanded)}
        />
        <span className="settings-go-to-toggle-label">{t('common.list')}</span>
        <span className="settings-go-to-toggle-meta">
          {t('settings.activeCount', { active: activeCount, total: items.length })}
        </span>
      </button>

      {renderExpandedGoToList({
        isListExpanded,
        items,
        listContext,
        listHint: t('settings.goToHint'),
        listAriaLabel: t('settings.goToListAria'),
      })}
    </SettingsToggleRow>
  )
}
