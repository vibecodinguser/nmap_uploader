import {
  parseDeleteGroupRequest,
  parseDeleteNoteRequest,
  parseMoveNoteRequest,
  parseMoveNotesRequest,
  parseNoteIds,
  parseSaveGroupRequest,
  parseSaveNoteRequest,
} from '@/lib/notes/application/requests'
import {
  NOTES_DELETE_GROUP_ACTION,
  NOTES_DELETE_NOTE_ACTION,
  NOTES_DELETE_NOTES_ACTION,
  NOTES_MOVE_NOTE_ACTION,
  NOTES_MOVE_NOTES_ACTION,
  NOTES_SAVE_GROUP_ACTION,
  NOTES_SAVE_NOTE_ACTION,
} from '@/lib/notes/protocol'
import { deleteNotes, moveNotesToGroup } from '@/lib/notes/storage/batch_repository'
import {
  deleteGroup,
  deleteNote,
  moveNoteToGroup,
  saveGroup,
  saveNote,
} from '@/lib/notes/storage/repository'
import { mutationHandler } from './mutation_handler'

/**
 * Мутации заметок и групп.
 *
 * Каждый обработчик — три строки: какой разбор, какая операция хранилища.
 * Слияние манифеста, перенос геометрии между шардами и очередь записи живут в
 * `lib/notes/storage/repository.ts` и не знают про сообщения.
 */

export const handleNotesSaveNote = mutationHandler({
  action: NOTES_SAVE_NOTE_ACTION,
  parse: parseSaveNoteRequest,
  run: (ports, request) => saveNote({ ports, ...request }),
})

export const handleNotesDeleteNote = mutationHandler({
  action: NOTES_DELETE_NOTE_ACTION,
  parse: parseDeleteNoteRequest,
  run: (ports, request) => deleteNote({ ports, ...request }),
})

export const handleNotesSaveGroup = mutationHandler({
  action: NOTES_SAVE_GROUP_ACTION,
  parse: parseSaveGroupRequest,
  run: (ports, request) => saveGroup({ ports, ...request }),
})

export const handleNotesDeleteGroup = mutationHandler({
  action: NOTES_DELETE_GROUP_ACTION,
  parse: parseDeleteGroupRequest,
  run: (ports, request) => deleteGroup({ ports, ...request }),
})

export const handleNotesMoveNote = mutationHandler({
  action: NOTES_MOVE_NOTE_ACTION,
  parse: parseMoveNoteRequest,
  run: (ports, request) => moveNoteToGroup({ ports, ...request }),
})

/**
 * Массовые действия.
 *
 * Отдельные действия, а не цикл одиночных: сто заметок — это одна запись
 * манифеста и по одной записи на затронутый шард, а не сто повторов.
 */
export const handleNotesDeleteNotes = mutationHandler({
  action: NOTES_DELETE_NOTES_ACTION,
  parse: (message) => {
    const noteIds = parseNoteIds(message)
    return noteIds.ok ? { ok: true, value: { noteIds: noteIds.value } } : noteIds
  },
  run: (ports, request) => deleteNotes({ ports, ...request }),
})

export const handleNotesMoveNotes = mutationHandler({
  action: NOTES_MOVE_NOTES_ACTION,
  parse: parseMoveNotesRequest,
  run: (ports, request) => moveNotesToGroup({ ports, ...request }),
})
