import { describe, expect, it } from 'vitest'
import { applyPatch, withHiddenIds } from '@/lib/notes/application/load'
import {
  parseDeleteGroupRequest,
  parseDeleteNoteRequest,
  parseHiddenIds,
  parseMoveNoteRequest,
  parseSaveGroupRequest,
  parseSaveNoteRequest,
} from '@/lib/notes/application/requests'
import type { NotesManifest } from '@/lib/notes/model/manifest'
import type { Note } from '@/lib/notes/model/types'
import { sampleGroup, sampleNote } from '@/tests/unit/notes_panel/list_props'

/**
 * Разбор сообщений — единственное место, где решается, что запрос валиден.
 * Проверяется без `chrome.*`: это чистые функции.
 */
const pointGeometry = { kind: 'Point' as const, coords: [37.6, 55.7] as [number, number] }

const manifest = (notes: Note[]): NotesManifest => ({
  version: 1,
  updatedAt: '2026-11-14T10:00:00.000Z',
  groups: [],
  notes,
})

describe('разбор запросов заметок', () => {
  it('принимает корректную заметку с геометрией', () => {
    const parsed = parseSaveNoteRequest({ note: sampleNote(), geometry: pointGeometry })

    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.value.note.id).toBe('note-1')
      expect(parsed.value.geometry).toEqual(pointGeometry)
    }
  })

  it('отбрасывает заметку без вида или с битой датой', () => {
    expect(parseSaveNoteRequest({ note: { id: 'x' }, geometry: pointGeometry }).ok).toBe(false)
    expect(
      parseSaveNoteRequest({
        note: sampleNote({ date: '14/11/2026' }),
        geometry: pointGeometry,
      }).ok,
    ).toBe(false)
  })

  it('отбрасывает вырожденную геометрию', () => {
    expect(
      parseSaveNoteRequest({
        note: sampleNote(),
        geometry: { kind: 'Line', coords: [[37, 55]] },
      }).ok,
    ).toBe(false)
  })

  it('достраивает замыкание многоугольника', () => {
    const parsed = parseSaveNoteRequest({
      note: sampleNote({ kind: 'Polygon' }),
      geometry: {
        kind: 'Polygon',
        coords: [
          [37, 55],
          [38, 55],
          [38, 56],
        ],
      },
    })

    expect(parsed.ok).toBe(true)
    if (parsed.ok && parsed.value.geometry.kind === 'Polygon') {
      expect(parsed.value.geometry.coords).toHaveLength(4)
    }
  })

  it('удаление без noteId отклоняется, дата необязательна', () => {
    expect(parseDeleteNoteRequest({}).ok).toBe(false)
    expect(parseDeleteNoteRequest({ noteId: 'note-1' })).toEqual({
      ok: true,
      value: { noteId: 'note-1', date: undefined },
    })
    expect(parseDeleteNoteRequest({ noteId: 'note-1', date: '14-11-2026' })).toEqual({
      ok: true,
      value: { noteId: 'note-1', date: '14-11-2026' },
    })
  })

  it('удаление группы без режима распускает её', () => {
    expect(parseDeleteGroupRequest({ groupId: 'g' })).toEqual({
      ok: true,
      value: { groupId: 'g', mode: 'keepNotes' },
    })
    expect(parseDeleteGroupRequest({ groupId: 'g', mode: 'cascade' })).toEqual({
      ok: true,
      value: { groupId: 'g', mode: 'cascade' },
    })
    expect(parseDeleteGroupRequest({ groupId: 'g', mode: 'что-то' })).toEqual({
      ok: true,
      value: { groupId: 'g', mode: 'keepNotes' },
    })
  })

  it('перенос без groupId уводит заметку в корень', () => {
    expect(parseMoveNoteRequest({ noteId: 'note-1' })).toEqual({
      ok: true,
      value: { noteId: 'note-1', groupId: null },
    })
  })

  it('группа без id отклоняется', () => {
    expect(parseSaveGroupRequest({ group: sampleGroup() }).ok).toBe(true)
    expect(parseSaveGroupRequest({ group: { name: 'Без id' } }).ok).toBe(false)
  })

  it('скрытые id фильтруются от мусора', () => {
    expect(parseHiddenIds({ hiddenIds: ['a', 1, null, 'b'] })).toEqual({
      ok: true,
      value: ['a', 'b'],
    })
    expect(parseHiddenIds({ hiddenIds: 'a' }).ok).toBe(false)
  })
})

describe('состояние снимка', () => {
  it('патч заменяет манифест и только затронутые шарды', () => {
    const base = {
      manifest: manifest([sampleNote({ id: 'old' })]),
      shards: {
        '2026-10': { version: 1, updatedAt: 'x', notes: {} },
        '2026-11': { version: 1, updatedAt: 'x', notes: {} },
      },
    }
    const patch = {
      manifest: manifest([sampleNote({ id: 'new' })]),
      shards: { '2026-11': { version: 1, updatedAt: 'y', notes: {} } },
    }

    const next = applyPatch(base, patch)

    expect(next.manifest.notes.map((note) => note.id)).toEqual(['new'])
    // Незатронутый шард остаётся: иначе сохранение одной заметки стирало бы
    // геометрию остальных дат.
    expect(Object.keys(next.shards).sort()).toEqual(['2026-10', '2026-11'])
    expect(next.shards['2026-11']?.updatedAt).toBe('y')
  })

  it('патч на пустом состоянии не требует предыдущего снимка', () => {
    const next = applyPatch(null, { manifest: manifest([]), shards: {} })

    expect(next).toEqual({ manifest: manifest([]), shards: {} })
  })

  it('скрытые id добавляются к состоянию хранилища', async () => {
    const snapshot = await withHiddenIds({ manifest: manifest([]), shards: {} }, async () => ['a'])

    expect(snapshot.hiddenIds).toEqual(['a'])
  })
})
