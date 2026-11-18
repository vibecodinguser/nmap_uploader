import { useLocale } from '@/hooks/useLocale'
import { formatDateTimeDisplay } from '@/lib/date_format'
import type { Note, NoteGroup } from '@/lib/notes/model/types'
import { kindLabelKey } from '@/lib/notes/panel/labels'
import { NOTES_PANEL_BUTTON_IDS } from './ids'
import { NoteAppearance } from './NoteAppearance'
import { NotesSelect } from './NotesSelect'

/** Свойства выбранной заметки. */
export const NoteProperties = ({
  note,
  fallbackName,
  onPatch,
  onBack,
  groups,
  onMoveToGroup,
}: {
  note: Note
  /** Автоимя «дд.мм.гггг + вид»: подставляется, если название стёрли. */
  fallbackName: string
  onPatch: (patch: Partial<Note>) => void
  onBack: () => void
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

        {/*
         * Вид, дата и время создания — одной строкой и только для чтения.
         * Дата больше не редактируется: она задавала шард геометрии на Диске,
         * и правка молча переносила файлы между месяцами. Создание — факт,
         * который не должен зависеть от набора в поле.
         */}
        <span className="notes-panel__properties-kind">
          {t(kindLabelKey(note.kind))}
          <time className="notes-panel__properties-time" dateTime={note.createdAt}>
            {formatDateTimeDisplay(note.createdAt)}
          </time>
        </span>
      </div>

      {/*
       * Одна сетка на всю карточку; места блоков — именованные области,
       * раскладка по ширине описана в `note_properties.css`. Порядок в разметке
       * — порядок чтения в одну колонку на узкой панели.
       */}
      <div className="notes-panel__properties-grid">
        <div className="notes-panel__identity">
          <label className="notes-panel__field notes-panel__field--name">
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

          {groups.length > 0 && (
            /*
             * Не `label`: внутри кнопка, и клик по любому месту подписи
             * открывал бы список — включая клик по пункту.
             */
            <div className="notes-panel__field notes-panel__field--group">
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

          {/* Подпись — это название на карте, поэтому флажок стоит при нём. */}
          <label className="notes-panel__field notes-panel__field--checkbox notes-panel__field--show-label">
            <span className="notes-panel__check">
              <input
                type="checkbox"
                checked={note.showLabel}
                onChange={(event) => onPatch({ showLabel: event.target.checked })}
              />
            </span>
            <span>{t('notesPanel.showLabel')}</span>
          </label>
        </div>

        <label className="notes-panel__field notes-panel__field--description">
          <span className="notes-panel__field-label">{t('notesPanel.descriptionPlaceholder')}</span>
          <textarea
            className="notes-panel__input notes-panel__textarea"
            value={note.description}
            onChange={(event) => onPatch({ description: event.target.value })}
            placeholder={t('notesPanel.descriptionPlaceholder')}
          />
        </label>

        <NoteAppearance note={note} onPatch={onPatch} />
      </div>
    </div>
  )
}
