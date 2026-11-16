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
  /** Создать группу. */
  createGroup: 'nmapUploaderNotesPanelBtnCreateGroup',
  /** Свернуть или раскрыть группу. */
  groupToggle: 'nmapUploaderNotesPanelBtnGroupToggle',
  /** Скрыть или показать все объекты группы. */
  groupVisible: 'nmapUploaderNotesPanelBtnGroupVisible',
  /** Переименовать группу. */
  groupRename: 'nmapUploaderNotesPanelBtnGroupRename',
  /** Удалить группу. */
  groupDelete: 'nmapUploaderNotesPanelBtnGroupDelete',
  /** Цвет группы. */
  groupColor: 'nmapUploaderNotesPanelBtnGroupColor',
  /** Выбор группы в свойствах заметки. */
  noteGroup: 'nmapUploaderNotesPanelSelectGroup',
  /** Фильтр по виду фигуры. К нему добавляется вид: `...Kind-Point`. */
  filterKind: 'nmapUploaderNotesPanelBtnFilterKind',
  /** Сброс всех фильтров списка. */
  filterReset: 'nmapUploaderNotesPanelBtnFilterReset',
  /** Выбор группы для фильтра списка. */
  filterGroup: 'nmapUploaderNotesPanelSelectFilterGroup',
  /** Фильтр по видимости. */
  filterVisibility: 'nmapUploaderNotesPanelSelectFilterVisibility',
  /** Порядок списка. */
  filterSort: 'nmapUploaderNotesPanelSelectFilterSort',
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
