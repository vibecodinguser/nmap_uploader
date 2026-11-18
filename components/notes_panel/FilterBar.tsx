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
import { NotesSelect } from './NotesSelect'

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

      <div className="notes-panel__filter-selects">
        {groups.length > 0 && (
          <NotesSelect
            id={NOTES_PANEL_BUTTON_IDS.filterGroup}
            label={t('notesPanel.filterGroup')}
            value={filter.group}
            options={[
              { value: GROUP_FILTER_ALL, label: t('notesPanel.filterAllGroups') },
              { value: GROUP_FILTER_NONE, label: t('notesPanel.ungrouped') },
              ...groups.map((group) => ({ value: group.id, label: group.name })),
            ]}
            onChange={(group) => onChange({ group })}
          />
        )}

        <NotesSelect
          id={NOTES_PANEL_BUTTON_IDS.filterVisibility}
          label={t('notesPanel.filterVisibility')}
          value={filter.visibility}
          options={[
            { value: 'all', label: t('notesPanel.filterVisibilityAll') },
            { value: 'visible', label: t('notesPanel.filterVisible') },
            { value: 'hidden', label: t('notesPanel.filterHidden') },
          ]}
          onChange={(visibility) => onChange({ visibility: visibility as VisibilityFilter })}
        />

        <NotesSelect
          id={NOTES_PANEL_BUTTON_IDS.filterSort}
          label={t('notesPanel.sort')}
          value={filter.sort}
          options={[
            { value: 'name', label: t('notesPanel.sortName') },
            { value: 'nameDesc', label: t('notesPanel.sortNameDesc') },
            { value: 'date', label: t('notesPanel.sortDate') },
            { value: 'dateDesc', label: t('notesPanel.sortDateDesc') },
          ]}
          onChange={(sort) => onChange({ sort: sort as NoteSort })}
        />

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
    </div>
  )
}
