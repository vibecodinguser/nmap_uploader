import { useLocale } from '@/hooks/useLocale'
import type { NoteGroup } from '@/lib/notes/model/types'

/**
 * Панель массовых действий.
 *
 * Появляется только когда что-то отмечено: постоянно висящая панель с
 * неактивными кнопками отнимает место у списка, который и так живёт в четверти
 * экрана.
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
        <select
          className="notes-panel__filter-select"
          aria-label={t('notesPanel.moveToGroup')}
          value=""
          onChange={(event) => {
            if (event.target.value === '') return
            onMoveToGroup(event.target.value === '__none__' ? null : event.target.value)
          }}
        >
          <option value="">{t('notesPanel.moveToGroup')}</option>
          <option value="__none__">{t('notesPanel.ungrouped')}</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      )}

      <button
        type="button"
        className="notes-panel__button notes-panel__button--danger"
        onClick={onDelete}
      >
        {t('notesPanel.deleteSelected')}
      </button>

      <button type="button" className="notes-panel__link-button" onClick={onClear}>
        {t('notesPanel.clearSelection')}
      </button>
    </section>
  )
}
