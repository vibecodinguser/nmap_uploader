import { GripVertical } from 'lucide-react'
import { type ChangeEvent, type KeyboardEvent, memo, type PointerEvent } from 'react'
import type { useGoToLinks } from '@/hooks/useGoToLinks'
import { useLocale, useTranslate } from '@/hooks/useLocale'
import type { GoToItem } from '@/lib/go_to_settings'
import { getGoToSourceDisplayName, getGoToSourceIconUrl } from '@/lib/go_to_sources'

const GO_TO_HANDLE_ICON_SIZE = 16

type GoToLinksSettingsItemProps = Readonly<{
  item: GoToItem
  isLoaded: boolean
  /** Строку сейчас перетаскивают. */
  isDragging: boolean
  setItemActive: ReturnType<typeof useGoToLinks>['setItemActive']
  /** Сдвигает пункт на один шаг: `-1` вверх, `1` вниз. */
  moveItemBy: (name: string, offset: number) => void
  onHandlePointerDown: (event: PointerEvent<HTMLElement>, name: string) => void
}>

/** Стрелки на ручке двигают пункт; на краю списка сдвиг ничего не делает. */
const getKeyboardOffset = (key: string): number | null => {
  if (key === 'ArrowUp') return -1
  if (key === 'ArrowDown') return 1
  return null
}

const GoToLinksSettingsItemBase = ({
  item,
  isLoaded,
  isDragging,
  setItemActive,
  moveItemBy,
  onHandlePointerDown,
}: GoToLinksSettingsItemProps) => {
  const t = useTranslate()
  const { locale } = useLocale()
  const displayName = getGoToSourceDisplayName(item.name, locale)
  const iconUrl = getGoToSourceIconUrl(item.name)

  const handleActiveChange = (event: ChangeEvent<HTMLInputElement>) => {
    setItemActive(item.name, event.target.checked)
  }

  const handleDragPointerDown = (event: PointerEvent<HTMLElement>) => {
    onHandlePointerDown(event, item.name)
  }

  const handleHandleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const offset = getKeyboardOffset(event.key)
    if (offset === null) return
    event.preventDefault()
    moveItemBy(item.name, offset)
  }

  return (
    <li
      className="settings-go-to-item"
      data-go-to-name={item.name}
      data-dragging={isDragging ? 'true' : undefined}
    >
      {/* Ручка — не только мышь: стрелки на ней переставляют пункт, поэтому
          клавиатурный путь живёт здесь, а не в отдельных кнопках ↑/↓. */}
      <button
        type="button"
        className="settings-go-to-drag-handle"
        aria-label={t('settings.reorderAria', { name: displayName })}
        onPointerDown={handleDragPointerDown}
        onKeyDown={handleHandleKeyDown}
      >
        <GripVertical size={GO_TO_HANDLE_ICON_SIZE} aria-hidden />
      </button>

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
    </li>
  )
}

export const GoToLinksSettingsItem = memo(GoToLinksSettingsItemBase)
