import { createEmptyShard, setShardGeometry, shardIdForDate } from '../model/shards'
import type { Note, NoteGeometry, NoteGroup } from '../model/types'
import type { NotesSnapshot } from '../protocol'
import type { GroupDeleteMode } from './state'

/**
 * Правки снимка для оптимистичного интерфейса.
 *
 * Панель показывает изменение до ответа Диска, поэтому ей нужны те же правила,
 * что и хранилищу: шард выбирается по месяцу даты, геометрия кладётся туда же,
 * манифест остаётся единственным источником атрибутов.
 */

/** Снимок с добавленной или обновлённой заметкой и её геометрией. */
export const withNote = (
  snapshot: NotesSnapshot,
  note: Note,
  geometry: NoteGeometry,
): NotesSnapshot => {
  const shardId = shardIdForDate(note.date)
  const others = snapshot.manifest.notes.filter((item) => item.id !== note.id)
  const manifest = { ...snapshot.manifest, notes: [...others, note] }
  if (!shardId) return { ...snapshot, manifest }

  const shard = setShardGeometry(snapshot.shards[shardId] ?? createEmptyShard(), note.id, geometry)
  return { ...snapshot, manifest, shards: { ...snapshot.shards, [shardId]: shard } }
}

/** Снимок без заметки. Геометрию не трогаем: она уедет снимком с Диска. */
export const withoutNote = (snapshot: NotesSnapshot, noteId: string): NotesSnapshot => ({
  ...snapshot,
  manifest: {
    ...snapshot.manifest,
    notes: snapshot.manifest.notes.filter((item) => item.id !== noteId),
  },
})

/** Замена атрибутов заметки без изменения геометрии. */
export const replaceNote = (snapshot: NotesSnapshot, note: Note): NotesSnapshot => ({
  ...snapshot,
  manifest: {
    ...snapshot.manifest,
    notes: snapshot.manifest.notes.map((item) => (item.id === note.id ? note : item)),
  },
})

/** Создание или переименование группы — одна и та же операция. */
export const withGroup = (snapshot: NotesSnapshot, group: NoteGroup): NotesSnapshot => {
  const exists = snapshot.manifest.groups.some((item) => item.id === group.id)
  const groups = exists
    ? snapshot.manifest.groups.map((item) => (item.id === group.id ? group : item))
    : [...snapshot.manifest.groups, group]
  return { ...snapshot, manifest: { ...snapshot.manifest, groups } }
}

/**
 * Удаление группы.
 *
 * `keepNotes` распускает её: заметки остаются на карте и уходят в корень.
 * `cascade` удаляет и заметки — это выбор пользователя в диалоге.
 */
export const withoutGroup = (
  snapshot: NotesSnapshot,
  groupId: string,
  mode: GroupDeleteMode,
): NotesSnapshot => ({
  ...snapshot,
  manifest: {
    ...snapshot.manifest,
    groups: snapshot.manifest.groups.filter((group) => group.id !== groupId),
    notes:
      mode === 'cascade'
        ? snapshot.manifest.notes.filter((note) => note.groupId !== groupId)
        : snapshot.manifest.notes.map((note) =>
            note.groupId === groupId ? { ...note, groupId: null } : note,
          ),
  },
})

/** Перенос заметки в группу или в корень. */
export const withNoteGroup = (
  snapshot: NotesSnapshot,
  noteId: string,
  groupId: string | null,
  updatedAt: string,
): NotesSnapshot => ({
  ...snapshot,
  manifest: {
    ...snapshot.manifest,
    notes: snapshot.manifest.notes.map((note) =>
      note.id === noteId ? { ...note, groupId, updatedAt } : note,
    ),
  },
})
