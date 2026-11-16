import { useLocale } from '@/hooks/useLocale'
import type { Note, NoteGroup } from '@/lib/notes/model/types'
import { kindLabelKey } from '@/lib/notes/panel/labels'
import { NOTES_PANEL_BUTTON_IDS } from './ids'
import { NoteAppearance } from './NoteAppearance'
import { NoteDateField } from './NoteDateField'
import { NotesSelect } from './NotesSelect'

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

      <section className="notes-panel__section">
        <h2 className="notes-panel__section-title">{t('notesPanel.sectionMain')}</h2>

        {/*
         * Поля в ширину, а не столбиком: в карточке много свободного места, и
         * короткие поля (дата, группа) встают по два в ряд. На узкой панели
         * сетка сама схлопывается в одну колонку.
         */}
        <div className="notes-panel__fields">
          <label className="notes-panel__field notes-panel__field--wide">
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

          <label className="notes-panel__field notes-panel__field--wide">
            <span className="notes-panel__field-label">
              {t('notesPanel.descriptionPlaceholder')}
            </span>
            <textarea
              className="notes-panel__input notes-panel__textarea"
              value={note.description}
              onChange={(event) => onPatch({ description: event.target.value })}
              placeholder={t('notesPanel.descriptionPlaceholder')}
            />
          </label>

          <NoteDateField date={note.date} onCommit={(date) => onPatch({ date })} />

          {groups.length > 0 && (
            /*
             * Не `label`: внутри кнопка, и клик по любому месту подписи
             * открывал бы список — включая клик по пункту.
             */
            <div className="notes-panel__field">
              <span className="notes-panel__field-label">{t('notesPanel.group')}</span>
              <NotesSelect
                id={NOTES_PANEL_BUTTON_IDS.noteGroup}
                label={t('notesPanel.group')}
                block
                value={note.groupId ?? ''}
                options={[
                  { value: '', label: t('notesPanel.ungrouped') },
                  ...groups.map((group) => ({ value: group.id, label: group.name })),
                ]}
                onChange={(groupId) => onMoveToGroup(groupId || null)}
              />
            </div>
          )}
        </div>
      </section>

      <section className="notes-panel__section">
        <h2 className="notes-panel__section-title">{t('notesPanel.sectionAppearance')}</h2>
        <div className="notes-panel__fields">
          <NoteAppearance note={note} onPatch={onPatch} />
        </div>
      </section>

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
