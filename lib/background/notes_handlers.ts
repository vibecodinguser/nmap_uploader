/**
 * Фоновые обработчики заметок.
 *
 * Реестр действий: сами обработчики разложены по `lib/background/notes/` —
 * загрузка, мутации, иконки, рисование, скрытие. Общая обвязка (проверка
 * отправителя, порты, рассылка) — в `notes/guard.ts`.
 */
export { handleNotesDrawFinished, handleNotesSelect, handleNotesStartDraw } from './notes/drawing'
export { handleNotesUploadIcon } from './notes/icons'
export { handleNotesLoad } from './notes/load'
export {
  handleNotesDeleteGroup,
  handleNotesDeleteNote,
  handleNotesMoveNote,
  handleNotesSaveGroup,
  handleNotesSaveNote,
} from './notes/mutations'
export { handleNotesHiddenChanged } from './notes/visibility'
