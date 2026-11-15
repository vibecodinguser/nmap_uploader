/**
 * id кнопок панели свойств.
 *
 * В свойствах каждая кнопка в единственном экземпляре, поэтому id стабильные и
 * без суффиксов.
 *
 * В строке списка кнопок столько же, сколько заметок, а id в документе обязан
 * быть уникальным: там действует схема `noteRowIds` из `NoteList.tsx` —
 * `notes-panel_btn_visible_<id заметки>` и т. д. Плюс `data-action` у кнопки и
 * `data-note-id` / `data-note-kind` у самой строки.
 */
export const NOTES_PANEL_BUTTON_IDS = {
  /** Показать или скрыть объект на карте. */
  visible: 'notes_panel_btn_visible',
  /** Найти объект на карте. */
  find: 'notes_panel_btn_find',
  /** Удалить заметку. */
  delete: 'notes_panel_btn_delete',
} as const
