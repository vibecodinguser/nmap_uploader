import { describe, expect, it } from 'vitest'
import { buildAutoNoteName } from '@/lib/notes/model/autonames'

describe('buildAutoNoteName', () => {
  it('складывает дату и вид объекта', () => {
    expect(buildAutoNoteName({ date: '14-11-2026', kindLabel: 'Точка', existingNames: [] })).toBe(
      '14-11-2026 Точка',
    )
  })

  it('нумерует повторные имена того же дня и вида', () => {
    const names = ['14-11-2026 Точка', '14-11-2026 Точка 2']

    expect(
      buildAutoNoteName({ date: '14-11-2026', kindLabel: 'Точка', existingNames: names }),
    ).toBe('14-11-2026 Точка 3')
  })

  it('не спотыкается о занятый номер в середине', () => {
    const names = ['14-11-2026 Точка', '14-11-2026 Точка 3']

    expect(
      buildAutoNoteName({ date: '14-11-2026', kindLabel: 'Точка', existingNames: names }),
    ).toBe('14-11-2026 Точка 2')
  })

  it('не зависит от вида других заметок', () => {
    expect(
      buildAutoNoteName({
        date: '14-11-2026',
        kindLabel: 'Круг',
        existingNames: ['14-11-2026 Точка', '14-11-2026 Линия'],
      }),
    ).toBe('14-11-2026 Круг')
  })
})
