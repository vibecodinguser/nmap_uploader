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
       * Одна сетка на восемь колонок — вся карточка целиком, без разделов
       * «Основное» и «Оформление»: раскладка задана линиями, и заголовки
       * разрывали бы её пополам.
       *
       *   линия 1: название 3 | группа 1 | иконка 4
       *   линия 2: описание 4 | цвет 2 | границы 2
       *   линия 3: поверхность 2
       *
       * Места задаются явно (`grid-area`), а не порядком в разметке: так
       * описание стоит после названия в DOM — это даёт правильный порядок при
       * переносе в одну колонку на узком экране.
       */}
      <div className="notes-panel__properties-grid">
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
