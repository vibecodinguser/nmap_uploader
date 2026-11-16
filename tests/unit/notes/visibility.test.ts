import { describe, expect, it } from 'vitest'
import { pruneHiddenIds, setNotesHidden, toggleHiddenNoteId } from '@/lib/notes/model/visibility'

describe('notes visibility', () => {
  it('добавляет и убирает id при переключении', () => {
    expect(toggleHiddenNoteId([], 'a')).toEqual(['a'])
    expect(toggleHiddenNoteId(['a'], 'a')).toEqual([])
    expect(toggleHiddenNoteId(['a'], 'b')).toEqual(['a', 'b'])
  })

  it('скрывает и показывает набор заметок', () => {
    expect(setNotesHidden([], ['a', 'b'], true)).toEqual(['a', 'b'])
    expect(setNotesHidden(['a', 'b'], ['a'], false)).toEqual(['b'])
    expect(setNotesHidden(['a'], ['b'], false)).toEqual(['a'])
  })

  it('убирает id удалённых заметок', () => {
    expect(pruneHiddenIds(['a', 'b', 'c'], ['a', 'c'])).toEqual(['a', 'c'])
    expect(pruneHiddenIds(['deleted'], [])).toEqual([])
    expect(pruneHiddenIds([], ['a'])).toEqual([])
  })
})
