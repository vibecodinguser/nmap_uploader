/**
 * id элементов панели заметок.
 *
 * Стиль повторяет id остальных элементов расширения на странице карты
 * (`nmapUploaderNotesButton`, `nmapUploaderPolygonUploadButton`): camelCase с
 * префиксом `nmapUploader`. Так к любому нашему элементу обращаются одинаково —
 * и в патче страницы, и в консоли, и в автотестах.
 */
export const NOTES_PANEL_BUTTON_IDS = {
  /** Показать или скрыть объект на карте. */
  visible: 'nmapUploaderNotesPanelBtnVisible',
  /** Найти объект на карте. */
  find: 'nmapUploaderNotesPanelBtnFind',
  /** Удалить заметку. */
  delete: 'nmapUploaderNotesPanelBtnDelete',
} as const

/**
 * id кнопки в строке списка.
 *
 * В свойствах каждая кнопка одна, а в списке их столько же, сколько заметок,
 * поэтому к базовому id добавляется идентификатор заметки — иначе id в
 * документе перестали бы быть уникальными и `getElementById` возвращал бы
 * первую строку вместо нужной.
 */
export const rowButtonId = (base: string, noteId: string): string => `${base}-${noteId}`
