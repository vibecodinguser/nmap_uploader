import { describe, expect, it } from 'vitest'
import {
  mergeManifests,
  NOTES_MANIFEST_VERSION,
  type NotesManifest,
  pruneTombstones,
  TOMBSTONE_TTL_DAYS,
} from '@/lib/notes/model/manifest'
import type { Note, NoteTombstone } from '@/lib/notes/model/types'
import { sampleNote } from '@/tests/unit/notes_panel/list_props'

/**
 * Надгробия решают конкретный дефект: удаление на одном устройстве раньше
 * возвращалось из копии другого, потому что отсутствие записи неотличимо от
 * «я эту заметку ещё не видел».
 */
const note = (id: string, updatedAt: string): Note =>
  sampleNote({ id, name: `Заметка ${id}`, updatedAt })

const manifest = ({
  notes = [],
  deletedNotes = [],
}: {
  notes?: Note[]
  deletedNotes?: NoteTombstone[]
} = {}): NotesManifest => ({
  version: NOTES_MANIFEST_VERSION,
  updatedAt: '2026-11-16T10:00:00.000Z',
  groups: [],
  notes,
  deletedNotes,
})

describe('слияние с надгробиями', () => {
  it('удаление доезжает до устройства со старой копией', () => {
    // Устройство A удалило заметку, устройство B ещё держит её у себя.
    const remote = manifest({
      deletedNotes: [{ id: 'note-1', deletedAt: '2026-11-16T12:00:00.000Z' }],
    })
    const local = manifest({ notes: [note('note-1', '2026-11-16T10:00:00.000Z')] })

    const merged = mergeManifests(remote, local)

    expect(merged.notes).toEqual([])
    expect(merged.deletedNotes.map((tombstone) => tombstone.id)).toEqual(['note-1'])
  })

  it('надгробие переживает слияние: следующая синхронизация тоже не вернёт заметку', () => {
    const remote = manifest({
      deletedNotes: [{ id: 'note-1', deletedAt: '2026-11-16T12:00:00.000Z' }],
    })
    const local = manifest({ notes: [note('note-1', '2026-11-16T10:00:00.000Z')] })

    const merged = mergeManifests(remote, local)
    const again = mergeManifests(merged, local)

    expect(again.notes).toEqual([])
  })

  it('правка после удаления возвращает заметку и снимает надгробие', () => {
    // Возврат после удаления: заметку сохранили заново, её метка новее удаления.
    const remote = manifest({
      deletedNotes: [{ id: 'note-1', deletedAt: '2026-11-16T12:00:00.000Z' }],
    })
    const local = manifest({ notes: [note('note-1', '2026-11-16T13:00:00.000Z')] })

    const merged = mergeManifests(remote, local)

    expect(merged.notes.map((item) => item.id)).toEqual(['note-1'])
    // Иначе следующее слияние удалило бы её снова.
    expect(merged.deletedNotes).toEqual([])
  })

  it('удаление позже правки побеждает', () => {
    const remote = manifest({
      deletedNotes: [{ id: 'note-1', deletedAt: '2026-11-16T14:00:00.000Z' }],
    })
    const local = manifest({ notes: [note('note-1', '2026-11-16T13:00:00.000Z')] })

    expect(mergeManifests(remote, local).notes).toEqual([])
  })

  it('равные метки считаются удалением', () => {
    // Одна и та же секунда: безопаснее удалить, чем показать призрак.
    const remote = manifest({
      deletedNotes: [{ id: 'note-1', deletedAt: '2026-11-16T12:00:00.000Z' }],
    })
    const local = manifest({ notes: [note('note-1', '2026-11-16T12:00:00.000Z')] })

    expect(mergeManifests(remote, local).notes).toEqual([])
  })

  it('надгробия разных устройств сливаются по более поздней дате', () => {
    const remote = manifest({
      deletedNotes: [{ id: 'note-1', deletedAt: '2026-11-16T10:00:00.000Z' }],
    })
    const local = manifest({
      deletedNotes: [{ id: 'note-1', deletedAt: '2026-11-16T12:00:00.000Z' }],
    })

    const merged = mergeManifests(remote, local)

    expect(merged.deletedNotes).toEqual([{ id: 'note-1', deletedAt: '2026-11-16T12:00:00.000Z' }])
  })

  it('надгробия по разным заметкам не мешают друг другу', () => {
    const remote = manifest({
      deletedNotes: [{ id: 'note-1', deletedAt: '2026-11-16T12:00:00.000Z' }],
    })
    const local = manifest({
      notes: [
        note('note-1', '2026-11-16T10:00:00.000Z'),
        note('note-2', '2026-11-16T10:00:00.000Z'),
      ],
      deletedNotes: [{ id: 'note-3', deletedAt: '2026-11-16T12:00:00.000Z' }],
    })

    const merged = mergeManifests(remote, local)

    expect(merged.notes.map((item) => item.id)).toEqual(['note-2'])
    expect(merged.deletedNotes.map((tombstone) => tombstone.id).sort()).toEqual([
      'note-1',
      'note-3',
    ])
  })

  it('заметка, о которой надгробий нет, не страдает', () => {
    const remote = manifest({
      deletedNotes: [{ id: 'gone', deletedAt: '2026-11-16T12:00:00.000Z' }],
    })
    const local = manifest({ notes: [note('alive', '2026-11-16T10:00:00.000Z')] })

    expect(mergeManifests(remote, local).notes.map((item) => item.id)).toEqual(['alive'])
  })

  it('манифест без поля надгробий читается как «ничего не удаляли»', () => {
    // Так выглядит файл, записанный более старой версией расширения.
    const legacy = {
      version: 1,
      updatedAt: '2026-11-16T10:00:00.000Z',
      groups: [],
      notes: [note('note-1', '2026-11-16T10:00:00.000Z')],
    } as unknown as NotesManifest

    const merged = mergeManifests(legacy, manifest())

    expect(merged.notes.map((item) => item.id)).toEqual(['note-1'])
    expect(merged.deletedNotes).toEqual([])
  })
})

describe('срок жизни надгробий', () => {
  const now = Date.parse('2026-12-31T00:00:00.000Z')
  const daysAgo = (days: number): string => new Date(now - days * 24 * 60 * 60 * 1000).toISOString()

  it('свежие надгробия остаются', () => {
    const tombstones = [{ id: 'recent', deletedAt: daysAgo(2) }]

    expect(pruneTombstones(tombstones, now)).toEqual(tombstones)
  })

  it('просроченные удаляются', () => {
    const tombstones = [{ id: 'old', deletedAt: daysAgo(TOMBSTONE_TTL_DAYS + 1) }]

    expect(pruneTombstones(tombstones, now)).toEqual([])
  })

  it('граница срока держит надгробие', () => {
    const tombstones = [{ id: 'edge', deletedAt: daysAgo(TOMBSTONE_TTL_DAYS - 1) }]

    expect(pruneTombstones(tombstones, now)).toHaveLength(1)
  })

  it('пустой список не ломает расчёт', () => {
    expect(pruneTombstones([], now)).toEqual([])
  })

  it('битая дата считается просроченной', () => {
    // Иначе одно испорченное надгробие жило бы вечно и росло в файле.
    expect(pruneTombstones([{ id: 'broken', deletedAt: 'не дата' }], now)).toEqual([])
  })
})
