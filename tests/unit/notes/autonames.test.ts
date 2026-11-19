import { describe, expect, it } from 'vitest'
import { buildAutoGroupName, buildAutoNoteName } from '@/lib/notes/model/autonames'

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

describe('buildAutoGroupName', () => {
  const base = 'Новая группа'

  it('без тёзок оставляет базовое имя', () => {
    expect(buildAutoGroupName({ baseName: base, existingNames: [] })).toBe(base)
  })

  it('вторую группу нумерует, а не дублирует название', () => {
    // Две группы с одинаковым именем в списке не отличить друг от друга.
    expect(buildAutoGroupName({ baseName: base, existingNames: [base] })).toBe(`${base} 2`)
  })

  it('продолжает нумерацию, а не начинает заново', () => {
    expect(buildAutoGroupName({ baseName: base, existingNames: [base, `${base} 2`] })).toBe(
      `${base} 3`,
    )
  })

  it('занимает дырку в нумерации', () => {
    expect(buildAutoGroupName({ baseName: base, existingNames: [base, `${base} 3`] })).toBe(
      `${base} 2`,
    )
  })

  it('не сбивается от групп с другими именами', () => {
    expect(buildAutoGroupName({ baseName: base, existingNames: ['Мосты', 'Причалы'] })).toBe(base)
  })

  it('считает тёзкой имя с лишними пробелами', () => {
    // Пробелы по краям — тот же ввод, и рядом с «Новая группа» второй такое
    // имя читалось бы как дубль.
    expect(buildAutoGroupName({ baseName: base, existingNames: [`  ${base}  `] })).toBe(`${base} 2`)
  })
})
