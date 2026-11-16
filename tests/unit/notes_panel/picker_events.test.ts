// @vitest-environment happy-dom

/**
 * Один жест пользователя — одно событие выбора.
 *
 * Это условие, на котором держится «одна заметка на одну фигуру». Если оверлей
 * сообщит о выборе дважды, панель создаст две заметки с разными id, и обе
 * уедут на Диск.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { PointPickerOverlay } from '@/lib/nmaps/point_picker'
import { NMAPS_POINT_PICKED_EVENT } from '@/lib/nmaps_pick_point_notify'

const pickedEvents = (): number[][] => {
  const events: number[][] = []
  document.addEventListener(NMAPS_POINT_PICKED_EVENT, (event) => {
    events.push((event as CustomEvent).detail.coords)
  })
  return events
}

const makePicker = (geomType: string) =>
  new PointPickerOverlay(
    geomType,
    () => {},
    // API карты отдаёт [lon, lat]; оверлей переставляет порядок.
    () => [37.6, 55.7],
  )

const overlay = (): HTMLElement => document.body.lastElementChild as HTMLElement

const click = (target: EventTarget, type: string): void => {
  target.dispatchEvent(new MouseEvent(type, { clientX: 100, clientY: 100, bubbles: true }))
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('PointPickerOverlay: точка', () => {
  it('один клик даёт ровно одно событие и убирает оверлей', () => {
    const events = pickedEvents()
    const cleanup = makePicker('Point').start()
    const target = overlay()

    click(target, 'mousedown')

    expect(events).toHaveLength(1)
    expect(events[0]).toEqual([[55.7, 37.6]])
    // Оверлей снят синхронно: второй клик двойного нажатия уходит на карту,
    // а не в уже закрытый выбор.
    expect(document.body.contains(target)).toBe(false)
    cleanup()
  })

  it('двойной клик не создаёт вторую точку', () => {
    const events = pickedEvents()
    const cleanup = makePicker('Point').start()

    click(overlay(), 'mousedown')
    // Второй клик двойного нажатия попадает на карту: оверлея уже нет.
    click(document.body, 'mousedown')
    click(document.body, 'dblclick')

    expect(events).toHaveLength(1)
    cleanup()
  })

  it('отмена сообщает пустым набором, а не молчанием', () => {
    const events = pickedEvents()
    const cleanup = makePicker('Point').start()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    // Пустой набор — это «рисование прервано»: панель по нему выходит из
    // режима, иначе кнопки остались бы заблокированными.
    expect(events).toEqual([[]])
    cleanup()
  })
})

describe('PointPickerOverlay: повторный старт', () => {
  it('второй старт того же экземпляра не создаёт второй оверлей', () => {
    const picker = makePicker('Point')
    const cleanup = picker.start()
    picker.start()
    picker.start()

    expect(document.body.children).toHaveLength(1)
    cleanup()
  })
})
