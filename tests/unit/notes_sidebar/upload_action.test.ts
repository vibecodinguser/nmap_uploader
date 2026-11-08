import { describe, expect, it } from 'vitest'
import { isSidebarNotePayload } from '@/lib/notes_sidebar/upload_action'

const validNote = {
  coords: [
    [37.6, 55.7],
    [37.7, 55.8],
  ],
  geomType: 'Polygon',
  name: 'Дом',
  desc: '',
  date: '01-01-2025',
}

describe('isSidebarNotePayload', () => {
  it('принимает корректную заметку', () => {
    expect(isSidebarNotePayload(validNote)).toBe(true)
  })

  it('отклоняет неизвестный тип геометрии', () => {
    expect(isSidebarNotePayload({ ...validNote, geomType: 'Circle' })).toBe(false)
  })

  it('отклоняет пустые координаты и пустое название', () => {
    expect(isSidebarNotePayload({ ...validNote, coords: [] })).toBe(false)
    expect(isSidebarNotePayload({ ...validNote, name: '   ' })).toBe(false)
  })

  it('отклоняет не-объекты', () => {
    expect(isSidebarNotePayload(null)).toBe(false)
    expect(isSidebarNotePayload('note')).toBe(false)
  })
})
