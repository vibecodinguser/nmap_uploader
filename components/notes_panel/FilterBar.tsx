import { useLocale } from '@/hooks/useLocale'
import { NOTE_KINDS, type NoteGroup, type NoteKind } from '@/lib/notes/model/types'
import {
  GROUP_FILTER_ALL,
  GROUP_FILTER_NONE,
  hasActiveFilters,
  type NoteSort,
  type NotesFilter,
  type VisibilityFilter,
} from '@/lib/notes/panel/filters'
import { kindLabelKey } from '@/lib/notes/panel/labels'
import { NOTES_PANEL_BUTTON_IDS, rowButtonId } from './ids'
import { NoteKindIcon } from './NoteKindIcon'

/**
 * Фильтры списка: вид фигуры, группа, видимость и порядок.
 *
 * Виды — кнопками-переключателями: их пять, и «показать только многоугольники»
 * делается одним кликом, без раскрытия списка. Остальное — три `select`:
 * вариантов там больше, а визуального смысла в иконках нет.
 *
 * Фильтр по видимости работает поверх локального скрытия, поэтому он не меняет
 * данные заметок и не уезжает на Диск.
 */
export const FilterBar = ({
  filter,
  groups,
  onChange,
  onReset,
}: {
  filter: NotesFilter
  groups: readonly NoteGroup[]
  onChange: (patch: Partial<NotesFilter>) => void
  onReset: () => void
}) => {
  const { t } = useLocale()

  const toggleKind = (kind: NoteKind): void => {
    const next = filter.kinds.includes(kind)
      ? filter.kinds.filter((item) => item !== kind)
      : [...filter.kinds, kind]
    onChange({ kinds: next })
  }

  return (
    <div className="notes-panel__filters">
      <fieldset className="notes-panel__filter-kinds">
        <legend className="notes-panel__visually-hidden">{t('notesPanel.filterKind')}</legend>
        {NOTE_KINDS.map((kind) => {
          const active = filter.kinds.includes(kind)
          return (
            <button
              key={kind}
              type="button"
              id={rowButtonId(NOTES_PANEL_BUTTON_IDS.filterKind, kind)}
              className="notes-panel__filter-kind"
              data-active={active}
              aria-pressed={active}
              title={t(kindLabelKey(kind))}
              aria-label={t(kindLabelKey(kind))}
              onClick={() => toggleKind(kind)}
            >
              <NoteKindIcon kind={kind} />
            </button>
          )
        })}
      </fieldset>

      {groups.length > 0 && (
        <select
          id={NOTES_PANEL_BUTTON_IDS.filterGroup}
          className="notes-panel__filter-select"
          aria-label={t('notesPanel.filterGroup')}
          value={filter.group}
          onChange={(event) => onChange({ group: event.target.value })}
        >
          <option value={GROUP_FILTER_ALL}>{t('notesPanel.filterAllGroups')}</option>
          <option value={GROUP_FILTER_NONE}>{t('notesPanel.ungrouped')}</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      )}

      <select
        id={NOTES_PANEL_BUTTON_IDS.filterVisibility}
        className="notes-panel__filter-select"
        aria-label={t('notesPanel.filterVisibility')}
        value={filter.visibility}
        onChange={(event) => onChange({ visibility: event.target.value as VisibilityFilter })}
      >
        <option value="all">{t('notesPanel.filterVisibilityAll')}</option>
        <option value="visible">{t('notesPanel.filterVisible')}</option>
        <option value="hidden">{t('notesPanel.filterHidden')}</option>
      </select>

      <select
        id={NOTES_PANEL_BUTTON_IDS.filterSort}
        className="notes-panel__filter-select"
        aria-label={t('notesPanel.sort')}
        value={filter.sort}
        onChange={(event) => onChange({ sort: event.target.value as NoteSort })}
      >
        <option value="name">{t('notesPanel.sortName')}</option>
        <option value="nameDesc">{t('notesPanel.sortNameDesc')}</option>
        <option value="date">{t('notesPanel.sortDate')}</option>
        <option value="dateDesc">{t('notesPanel.sortDateDesc')}</option>
      </select>

      {hasActiveFilters(filter) && (
        <button
          type="button"
          id={NOTES_PANEL_BUTTON_IDS.filterReset}
          className="notes-panel__link-button"
          onClick={onReset}
        >
          {t('notesPanel.filterReset')}
        </button>
      )}
    </div>
  )
}
