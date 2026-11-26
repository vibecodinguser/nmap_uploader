import { ChevronRight } from 'lucide-react'
import { type ReactNode, type RefObject, useState } from 'react'
import { GoToLinksSettingsItem } from '@/components/GoToLinksSettingsItem'
import { SettingsToggleRow } from '@/components/SettingsToggleRow'
import type { useGoToLinks } from '@/hooks/useGoToLinks'
import { type GoToItemsDrag, useGoToListDrag } from '@/hooks/useGoToListDrag'
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
  | 'moveItemBy'
  | 'reorderItems'
> & {
  /** `card` — самостоятельная карточка настроек, `plain` — строка внутри общей секции. */
  variant?: 'card' | 'plain'
}

type GoToLinksListRenderContext = {
  isLoaded: boolean
  draggingName: string | null
  setItemActive: GoToLinksSettingsProps['setItemActive']
  moveItemBy: GoToLinksSettingsProps['moveItemBy']
  onHandlePointerDown: GoToItemsDrag['handlePointerDown']
}

type ExpandedGoToListProps = {
  isListExpanded: boolean
  items: GoToItem[]
  listContext: GoToLinksListRenderContext
  listRef: RefObject<HTMLUListElement | null>
  listAriaLabel: string
}

function buildGoToLinksListItems(
  items: GoToItem[],
  context: GoToLinksListRenderContext,
): ReactNode[] {
  const renderedItems: ReactNode[] = []
  for (const item of items) {
    renderedItems.push(
      <GoToLinksSettingsItem
        key={item.name}
        item={item}
        isLoaded={context.isLoaded}
        isDragging={context.draggingName === item.name}
        setItemActive={context.setItemActive}
        moveItemBy={context.moveItemBy}
        onHandlePointerDown={context.onHandlePointerDown}
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
        <ul className="settings-go-to-list" ref={props.listRef} aria-label={props.listAriaLabel}>
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
  moveItemBy,
  reorderItems,
  variant = 'card',
}: GoToLinksSettingsProps) => {
  const t = useTranslate()
  const [isListExpanded, setIsListExpanded] = useState(false)
  const drag = useGoToListDrag({ items, reorderItems })
  const activeCount = drag.displayedItems.filter(isActiveGoToItem).length

  const handleToggleList = () => {
    setIsListExpanded(getToggledListExpanded)
  }

  const listContext: GoToLinksListRenderContext = {
    isLoaded,
    draggingName: drag.draggingName,
    setItemActive,
    moveItemBy,
    onHandlePointerDown: drag.handlePointerDown,
  }

  return (
    <SettingsToggleRow
      id="settings-go-to-menu-enabled"
      variant={variant}
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
          {t('settings.activeCount', { active: activeCount, total: drag.displayedItems.length })}
        </span>
      </button>

      {renderExpandedGoToList({
        isListExpanded,
        items: drag.displayedItems,
        listContext,
        listRef: drag.listRef,
        listAriaLabel: t('settings.goToListAria'),
      })}
    </SettingsToggleRow>
  )
}
