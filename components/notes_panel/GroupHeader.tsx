import { useState } from 'react'
import { useGroupTitleEditing } from '@/hooks/notes_panel/useGroupTitleEditing'
import { useLocale } from '@/hooks/useLocale'
import type { GroupVisibility } from '@/lib/notes/model/grouping'
import { GroupActions } from './GroupActions'
import { Chevron } from './GroupIcons'
import { NOTES_PANEL_BUTTON_IDS, rowButtonId } from './ids'

export const groupHeaderIds = (groupId: string | null) => {
  const suffix = groupId ?? 'ungrouped'
  return {
    header: `nmapUploaderNotesGroup-${suffix}`,
    toggle: rowButtonId(NOTES_PANEL_BUTTON_IDS.groupToggle, suffix),
    visibility: rowButtonId(NOTES_PANEL_BUTTON_IDS.groupVisible, suffix),
    rename: rowButtonId(NOTES_PANEL_BUTTON_IDS.groupRename, suffix),
    remove: rowButtonId(NOTES_PANEL_BUTTON_IDS.groupDelete, suffix),
    color: rowButtonId(NOTES_PANEL_BUTTON_IDS.groupColor, suffix),
  }
}

/**
 * Заголовок группы в списке.
 *
 * У корня («Без группы») нет ни переименования, ни удаления, ни цвета: это не
 * сущность, а остаток заметок вне групп.
 */
export const GroupHeader = ({
  groupId,
  title,
  color,
  notesCount,
  collapsed,
  onToggle,
  onRename,
  onRecolor,
  onRemove,
  onDropNote,
  visibility,
  onToggleVisibility,
}: {
  groupId: string | null
  title: string
  color: string | null
  notesCount: number
  collapsed: boolean
  onToggle: () => void
  onRename?: (name: string) => void
  onRecolor?: (color: string) => void
  onRemove?: () => void
  /** Заметку перетащили на заголовок: перенести её в эту группу. */
  onDropNote?: (groupId: string | null) => void
  /** Видимость группы целиком: видна, скрыта или частично. */
  visibility: GroupVisibility
  onToggleVisibility: () => void
}) => {
  const { t } = useLocale()
  const [isDropHover, setIsDropHover] = useState(false)
  const editing = useGroupTitleEditing({ title, onRename })
  const ids = groupHeaderIds(groupId)
  const editable = groupId !== null

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: цель для перетаскивания, действия — в кнопках
    <div
      id={ids.header}
      className="notes-panel__group"
      data-group-id={groupId ?? ''}
      data-collapsed={collapsed}
      data-drop-hover={isDropHover}
      onDragOver={(event) => {
        // Без preventDefault браузер не считает элемент целью перетаскивания.
        event.preventDefault()
        event.stopPropagation()
        setIsDropHover(true)
      }}
      onDragLeave={() => setIsDropHover(false)}
      onDrop={(event) => {
        // Бросок обрабатывается здесь и только здесь: без stopPropagation он
        // всплывает до контейнера списка, а тот переносит заметку в корень —
        // объект «исчезал» из группы сразу после переноса.
        event.preventDefault()
        event.stopPropagation()
        setIsDropHover(false)
        onDropNote?.(groupId)
      }}
    >
      <button
        type="button"
        id={ids.toggle}
        data-action="toggle-group"
        className="notes-panel__group-toggle"
        aria-expanded={!collapsed}
        aria-label={collapsed ? t('notesPanel.expandGroup') : t('notesPanel.collapseGroup')}
        onClick={onToggle}
      >
        <Chevron collapsed={collapsed} />
        {color && (
          <span
            className="notes-panel__group-dot"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
        )}
        {editing.isEditing ? (
          <input
            ref={editing.inputRef}
            className="notes-panel__group-input"
            value={editing.draft}
            aria-label={t('notesPanel.renameGroup')}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => editing.setDraft(event.target.value)}
            onBlur={editing.commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') editing.commit()
              if (event.key === 'Escape') editing.cancel()
            }}
          />
        ) : (
          <span className="notes-panel__group-name">{title}</span>
        )}
        <span className="notes-panel__group-count">{notesCount}</span>
      </button>

      <GroupActions
        ids={ids}
        color={color}
        visibility={visibility}
        editable={editable && !editing.isEditing}
        onToggleVisibility={onToggleVisibility}
        onRecolor={onRecolor}
        onStartRename={editing.start}
        onRemove={onRemove}
      />
    </div>
  )
}
