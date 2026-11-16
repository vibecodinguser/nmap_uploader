import { describe, expect, it } from 'vitest'
import {
  estimateLabelWidth,
  LABEL_HEIGHT_PX,
  type LabelBox,
  selectVisibleLabels,
} from '@/lib/notes_layer/label_layout'

/**
 * Схлопывание подписей — чистая функция: проверяется без карты, включая
 * спорные случаи — приоритет выбранной заметки и стабильность выбора.
 */
const label = (id: string, lon: number, lat: number, text = 'Точка'): LabelBox => ({
  id,
  coordinates: [lon, lat],
  text,
})

describe('оценка размера', () => {
  it('ширина растёт с длиной текста', () => {
    expect(estimateLabelWidth('Мост')).toBeLessThan(estimateLabelWidth('Мост через реку'))
  })

  it('короткая подпись не сжимается до нуля', () => {
    expect(estimateLabelWidth('')).toBeGreaterThan(0)
  })

  it('высота строки задана для расчёта пересечений', () => {
    expect(LABEL_HEIGHT_PX).toBeGreaterThan(8)
  })
})

describe('пересечения', () => {
  it('одна подпись показывается всегда', () => {
    expect(selectVisibleLabels({ labels: [label('a', 37.6, 55.7)], zoom: 15 })).toHaveLength(1)
  })

  it('пустой список остаётся пустым', () => {
    expect(selectVisibleLabels({ labels: [], zoom: 15 })).toEqual([])
  })

  it('совпадающие координаты дают одну подпись', () => {
    const visible = selectVisibleLabels({
      labels: [label('a', 37.6, 55.7), label('b', 37.6, 55.7)],
      zoom: 15,
    })

    expect(visible).toHaveLength(1)
  })

  it('далёкие подписи остаются обе', () => {
    const visible = selectVisibleLabels({
      labels: [label('a', 37.6, 55.7), label('b', 39.6, 57.7)],
      zoom: 15,
    })

    expect(visible.map((item) => item.id).sort()).toEqual(['a', 'b'])
  })

  it('чем крупнее зум, тем больше подписей помещается', () => {
    const labels = Array.from({ length: 6 }, (_, index) =>
      label(`n${index}`, 37.6 + index * 0.0004, 55.7),
    )

    const far = selectVisibleLabels({ labels, zoom: 12 })
    const near = selectVisibleLabels({ labels, zoom: 17 })

    expect(near.length).toBeGreaterThan(far.length)
  })

  it('длинный текст схлопывается раньше короткого', () => {
    const long = Array.from({ length: 4 }, (_, index) =>
      label(`n${index}`, 37.6 + index * 0.0006, 55.7, 'Очень длинное название объекта'),
    )
    const short = Array.from({ length: 4 }, (_, index) =>
      label(`n${index}`, 37.6 + index * 0.0006, 55.7, 'Т'),
    )

    expect(selectVisibleLabels({ labels: long, zoom: 16 }).length).toBeLessThan(
      selectVisibleLabels({ labels: short, zoom: 16 }).length,
    )
  })
})

describe('приоритет', () => {
  it('выбранная заметка показывается первой', () => {
    const labels = [label('a', 37.6, 55.7), label('b', 37.6, 55.7)]

    const visible = selectVisibleLabels({ labels, zoom: 15, priority: ['b'] })

    expect(visible.map((item) => item.id)).toEqual(['b'])
  })

  it('без приоритета выбор стабилен между вызовами', () => {
    const labels = [label('b', 37.6, 55.7), label('a', 37.6, 55.7)]

    const first = selectVisibleLabels({ labels, zoom: 15 })
    const second = selectVisibleLabels({ labels: [...labels].reverse(), zoom: 15 })

    expect(first.map((item) => item.id)).toEqual(second.map((item) => item.id))
  })

  it('приоритет не ломает показ остальных, если они не пересекаются', () => {
    const labels = [label('a', 37.6, 55.7), label('b', 39.6, 57.7)]

    const visible = selectVisibleLabels({ labels, zoom: 15, priority: ['b'] })

    expect(visible.map((item) => item.id).sort()).toEqual(['a', 'b'])
  })
})

describe('нагрузка', () => {
  it('пять тысяч подписей не дают квадратичного перебора', () => {
    const labels = Array.from({ length: 5000 }, (_, index) =>
      label(`n${index}`, 37 + (index % 100) * 0.002, 55 + Math.floor(index / 100) * 0.002),
    )

    const started = performance.now()
    const visible = selectVisibleLabels({ labels, zoom: 14 })
    const elapsed = performance.now() - started

    expect(visible.length).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(500)
  })
})
