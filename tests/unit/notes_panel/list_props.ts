import type { ComponentProps } from 'react'
import type { NoteList } from '@/components/notes_panel/NoteList'
import type { Note, NoteGroup } from '@/lib/notes/types'

/** Полный набор пропсов списка заметок. */
export type NoteListProps = ComponentProps<typeof NoteList>

/**
 * Пропсы списка со значениями по умолчанию.
 *
 * Группировка не нужна большинству тестов: они проверяют строку заметки и её
 * действия. Общий помощник держит такие тесты короткими и не заставляет каждый
 * раз перечислять восемь обработчиков групп.
 */
export const listProps = (props: Partial<NoteListProps> = {}): NoteListProps => ({
  notes: [],
  hiddenIds: [],
  selectedId: null,
  onSelect: () => {},
  onToggleHidden: () => {},
  onLocate: () => {},
  onDelete: () => {},
  groups: [],
  collapsedGroupIds: [],
  onToggleGroup: () => {},
  onRenameGroup: () => {},
  onRecolorGroup: () => {},
  onRemoveGroup: () => {},
  onMoveNote: () => {},
  onToggleGroupVisibility: () => {},
  ...props,
})

export const sampleGroup = (overrides: Partial<NoteGroup> = {}): NoteGroup => ({
  id: 'group-1',
  name: 'Мосты',
  color: '#1a8cff',
  order: 0,
  createdAt: '2026-11-14T10:00:00.000Z',
  updatedAt: '2026-11-14T10:00:00.000Z',
  ...overrides,
})

export const sampleNote = (overrides: Partial<Note> = {}): Note => ({
  id: 'note-1',
  kind: 'Point',
  name: '14.11.2026 Точка',
  description: '',
  date: '14-11-2026',
  icon: null,
  showLabel: false,
  style: { color: null, fillColor: null, hatch: null, opacity: 1, strokeWidth: 3 },
  groupId: null,
  createdAt: '2026-11-14T10:00:00.000Z',
  updatedAt: '2026-11-14T10:00:00.000Z',
  ...overrides,
})
