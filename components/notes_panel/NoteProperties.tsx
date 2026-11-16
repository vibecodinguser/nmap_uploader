import { useLocale } from '@/hooks/useLocale'
import type { Note, NoteGroup } from '@/lib/notes/model/types'
import { kindLabelKey } from '@/lib/notes/panel/labels'
import { NOTES_PANEL_BUTTON_IDS } from './ids'
import { NoteAppearance } from './NoteAppearance'
import { NoteDateField } from './NoteDateField'

/** Свойства выбранной заметки. */
export const NoteProperties = ({
  note,
  fallbackName,
  hidden,
  onPatch,
  onDelete,
  onBack,
  onLocate,
  onToggleHidden,
  groups,
  onMoveToGroup,
}: {
  note: Note
  /** Автоимя «дд.мм.гггг + вид»: подставляется, если название стёрли. */
  fallbackName: string
  hidden: boolean
  onPatch: (patch: Partial<Note>) => void
  onDelete: () => void
  onBack: () => void
  onLocate: () => void
  onToggleHidden: () => void
  /** Группы для выбора принадлежности: клавиатурная замена перетаскиванию. */
  groups: readonly NoteGroup[]
  onMoveToGroup: (groupId: string | null) => void
}) => {
  const { t } = useLocale()

  return (
    <div className="notes-panel__properties">
      <div className="notes-panel__properties-head">
        <button type="button" className="notes-panel__link-button" onClick={onBack}>
          ← {t('notesPanel.back')}
        </button>
        <span className="notes-panel__properties-kind">{t(kindLabelKey(note.kind))}</span>
      </div>

      <label className="notes-panel__field">
        <span className="notes-panel__field-label">{t('notesPanel.namePlaceholder')}</span>
        <input
          className="notes-panel__input"
          value={note.name}
          onChange={(event) => onPatch({ name: event.target.value })}
          onBlur={() => {
            if (!note.name.trim()) onPatch({ name: fallbackName })
          }}
          placeholder={t('notesPanel.namePlaceholder')}
        />
      </label>

      <label className="notes-panel__field">
        <span className="notes-panel__field-label">{t('notesPanel.descriptionPlaceholder')}</span>
        <textarea
          className="notes-panel__input notes-panel__textarea"
          value={note.description}
          onChange={(event) => onPatch({ description: event.target.value })}
          placeholder={t('notesPanel.descriptionPlaceholder')}
        />
      </label>

      <NoteDateField date={note.date} onCommit={(date) => onPatch({ date })} />

      {groups.length > 0 && (
        <label className="notes-panel__field notes-panel__field--inline">
          <span className="notes-panel__field-label">{t('notesPanel.group')}</span>
          <select
            id={NOTES_PANEL_BUTTON_IDS.noteGroup}
            className="notes-panel__input"
            value={note.groupId ?? ''}
            onChange={(event) => onMoveToGroup(event.target.value || null)}
          >
            <option value="">{t('notesPanel.ungrouped')}</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <NoteAppearance note={note} onPatch={onPatch} />

      <div className="notes-panel__actions">
        <button
          type="button"
          id={NOTES_PANEL_BUTTON_IDS.find}
          className="notes-panel__button"
          onClick={onLocate}
        >
          {t('notesPanel.locate')}
        </button>
        <button
          type="button"
          id={NOTES_PANEL_BUTTON_IDS.visible}
          className="notes-panel__button"
          onClick={onToggleHidden}
        >
          {hidden ? t('notesPanel.visible') : t('notesPanel.hidden')}
        </button>
        <button
          type="button"
          id={NOTES_PANEL_BUTTON_IDS.delete}
          className="notes-panel__button notes-panel__button--danger"
          onClick={onDelete}
        >
          {t('notesPanel.delete')}
        </button>
      </div>
    </div>
  )
}
