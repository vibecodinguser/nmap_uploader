import { useEffect, useRef, useState } from 'react'
import { useLocale } from '@/hooks/useLocale'
import { NOTES_PANEL_BUTTON_IDS, rowButtonId } from './ids'

/** Стрелка «раскрыть/свернуть» — одна на заголовок группы. */
const Chevron = ({ collapsed }: { collapsed: boolean }) => (
  <svg
    width={14}
    height={14}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="notes-panel__group-chevron"
    data-collapsed={collapsed}
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
)

const PencilIcon = () => (
  <svg
    width={14}
    height={14}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z" />
  </svg>
)

const TrashIcon = () => (
  <svg
    width={14}
    height={14}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  </svg>
)

export const groupHeaderIds = (groupId: string | null) => {
  const suffix = groupId ?? 'ungrouped'
  return {
    header: `nmapUploaderNotesGroup-${suffix}`,
    toggle: rowButtonId(NOTES_PANEL_BUTTON_IDS.groupToggle, suffix),
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
}) => {
  const { t } = useLocale()
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(title)
  const [isDropHover, setIsDropHover] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Фокус ставим вручную: autofocus в разметке перехватывает внимание даже
  // когда пользователь просто пролистал список.
  useEffect(() => {
    if (!isEditing) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [isEditing])
  const ids = groupHeaderIds(groupId)
  const editable = groupId !== null

  const commit = (): void => {
    setIsEditing(false)
    const next = draft.trim()
    if (!next || next === title) {
      setDraft(title)
      return
    }
    onRename?.(next)
  }

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
        event.preventDefault()
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
        {isEditing ? (
          <input
            ref={inputRef}
            className="notes-panel__group-input"
            value={draft}
            aria-label={t('notesPanel.renameGroup')}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commit()
              if (event.key === 'Escape') {
                setDraft(title)
                setIsEditing(false)
              }
            }}
          />
        ) : (
          <span className="notes-panel__group-name">{title}</span>
        )}
        <span className="notes-panel__group-count">{notesCount}</span>
      </button>

      {editable && !isEditing && (
        <div className="notes-panel__group-actions">
          <label
            id={ids.color}
            data-action="group-color"
            className="notes-panel__group-color"
            title={t('notesPanel.groupColor')}
          >
            <input
              type="color"
              value={color ?? '#1a8cff'}
              aria-label={t('notesPanel.groupColor')}
              onChange={(event) => onRecolor?.(event.target.value)}
            />
          </label>
          <button
            type="button"
            id={ids.rename}
            data-action="rename-group"
            className="notes-panel__row-action"
            title={t('notesPanel.renameGroup')}
            aria-label={t('notesPanel.renameGroup')}
            onClick={() => {
              setDraft(title)
              setIsEditing(true)
            }}
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            id={ids.remove}
            data-action="delete-group"
            className="notes-panel__row-action notes-panel__row-action--danger"
            title={t('notesPanel.deleteGroup')}
            aria-label={t('notesPanel.deleteGroup')}
            onClick={onRemove}
          >
            <TrashIcon />
          </button>
        </div>
      )}
    </div>
  )
}
