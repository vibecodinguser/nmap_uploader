import { useLocale } from '@/hooks/useLocale'
import type { GroupVisibility } from '@/lib/notes/model/grouping'
import type { groupHeaderIds } from './GroupHeader'
import { PencilIcon } from './GroupIcons'
import { DeleteIcon, VisibilityIcon } from './RowIcons'

/**
 * Действия заголовка группы: видимость, цвет, переименование, удаление.
 *
 * У корня («Без группы») остаётся только видимость: переименовывать и удалять
 * нечего, цвет группы тоже не существует.
 */
export const GroupActions = ({
  ids,
  color,
  visibility,
  editable,
  onToggleVisibility,
  onRecolor,
  onStartRename,
  onRemove,
}: {
  ids: ReturnType<typeof groupHeaderIds>
  color: string | null
  visibility: GroupVisibility
  editable: boolean
  onToggleVisibility: () => void
  onRecolor?: (color: string) => void
  onStartRename: () => void
  onRemove?: () => void
}) => {
  const { t } = useLocale()

  return (
    <div className="notes-panel__group-actions">
      <button
        type="button"
        id={ids.visibility}
        data-action="group-visible"
        data-visibility={visibility}
        className="notes-panel__row-action"
        title={visibility === 'hidden' ? t('notesPanel.showGroup') : t('notesPanel.hideGroup')}
        aria-label={visibility === 'hidden' ? t('notesPanel.showGroup') : t('notesPanel.hideGroup')}
        aria-pressed={visibility !== 'hidden'}
        onClick={onToggleVisibility}
      >
        <VisibilityIcon hidden={visibility === 'hidden'} mixed={visibility === 'mixed'} />
      </button>

      {editable && (
        <>
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
            onClick={onStartRename}
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
            <DeleteIcon />
          </button>
        </>
      )}
    </div>
  )
}
