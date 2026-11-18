import { useLocale } from '@/hooks/useLocale'
import type { NoteGroup } from '@/lib/notes/model/types'
import { NotesSelect } from './NotesSelect'

/**
 * Панель массовых действий.
 *
 * Появляется только когда что-то отмечено, и встаёт на место строки
 * инструментов (`ListToolbar`): постоянно висящая панель с неактивными
 * кнопками отнимает место у списка, который и так живёт в четверти экрана.
 *
 * Удаление пачки не имеет возврата — в отличие от одиночного удаления: тост
 * «Отменить» не может вернуть десятки геометрий. Поэтому рядом с кнопкой
 * удаления показывается число отмеченных, а не обещание отмены.
 */
export const SelectionBar = ({
  count,
  groups,
  onSelectAll,
  onClear,
  onDelete,
  onMoveToGroup,
}: {
  count: number
  groups: readonly NoteGroup[]
  onSelectAll: () => void
  onClear: () => void
  onDelete: () => void
  onMoveToGroup: (groupId: string | null) => void
}) => {
  const { t } = useLocale()

  if (count === 0) return null

  return (
    <section className="notes-panel__selection" aria-label={t('notesPanel.selection')}>
      <span className="notes-panel__selection-count">
        {t('notesPanel.selectedCount', { count })}
      </span>

      <button type="button" className="notes-panel__link-button" onClick={onSelectAll}>
        {t('notesPanel.selectAll')}
      </button>

      {groups.length > 0 && (
        <NotesSelect
          label={t('notesPanel.moveToGroup')}
          value=""
          options={[
            { value: '', label: t('notesPanel.moveToGroup') },
            { value: '__none__', label: t('notesPanel.ungrouped') },
            ...groups.map((group) => ({ value: group.id, label: group.name })),
          ]}
          onChange={(groupId) => {
            if (groupId === '') return
            onMoveToGroup(groupId === '__none__' ? null : groupId)
          }}
        />
      )}

      <button
        type="button"
        className="notes-panel__button notes-panel__button--danger"
        onClick={onDelete}
      >
        {t('notesPanel.deleteSelected')}
      </button>

      <button
        type="button"
        className="notes-panel__link-button notes-panel__selection-exit"
        onClick={onClear}
      >
        {t('notesPanel.clearSelection')}
      </button>
    </section>
  )
}
