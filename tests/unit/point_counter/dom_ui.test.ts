// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PointCounterUi, UI_WRAPPER_ID } from '@/lib/point_counter/dom_ui'

describe('point_counter/dom_ui', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('ensureCreated создает элемент счетчика в DOM', () => {
    const ui = new PointCounterUi(
      () => (key: string, params?: Record<string, unknown>) => `${key}:${params?.count}`,
    )
    ui.ensureCreated()
    expect(document.getElementById(UI_WRAPPER_ID)).not.toBeNull()
  })

  it('show отображает счетчик с остатком точек', () => {
    const ui = new PointCounterUi(
      () => (key: string, params?: Record<string, unknown>) => `${key}:${params?.count}`,
    )
    ui.show(100)
    const el = document.getElementById(UI_WRAPPER_ID)
    expect(el?.style.display).toBe('block')
    expect(el?.textContent).toContain('400')
  })

  it('окрашивает подложку в красный цвет, когда остается менее 50 точек', () => {
    const ui = new PointCounterUi(
      () => (key: string, params?: Record<string, unknown>) => `${key}:${params?.count}`,
    )
    ui.show(460) // Остается 40 точек (менее 50)
    const el = document.getElementById(UI_WRAPPER_ID)
    expect(el?.style.display).toBe('block')
    expect(el?.textContent).toContain('40')
    expect(el?.style.backgroundColor).toContain('235, 32, 32')
  })

  it('отображает "Достигнут лимит на количество вершин" при 0 остатке', () => {
    const ui = new PointCounterUi(
      () => (key: string) =>
        key === 'mapPointCounter.limitReached' ? 'Достигнут лимит на количество вершин' : key,
    )
    ui.show(500)
    const el = document.getElementById(UI_WRAPPER_ID)
    expect(el?.textContent).toBe('Достигнут лимит на количество вершин')
    expect(el?.style.backgroundColor).toContain('235, 32, 32')

    // Также через showRemaining(0)
    ui.showRemaining(0)
    expect(el?.textContent).toBe('Достигнут лимит на количество вершин')
  })

  it('отображает "Лимит превышен на: X" при добавлении вершин сверх 500', () => {
    const ui = new PointCounterUi(
      () => (key: string, params?: Record<string, unknown>) =>
        key === 'mapPointCounter.limitExceeded' ? `Лимит превышен на: ${params?.count}` : key,
    )
    ui.show(505)
    const el = document.getElementById(UI_WRAPPER_ID)
    expect(el?.textContent).toBe('Лимит превышен на: 5')
    expect(el?.style.backgroundColor).toContain('235, 32, 32')

    // Также через showRemaining(-12)
    ui.showRemaining(-12)
    expect(el?.textContent).toBe('Лимит превышен на: 12')
  })

  it('hide скрывает счетчик', () => {
    const ui = new PointCounterUi(
      () => (key: string, params?: Record<string, unknown>) => `${key}:${params?.count}`,
    )
    ui.show(100)
    ui.hide()
    const el = document.getElementById(UI_WRAPPER_ID)
    expect(el?.style.display).toBe('none')
  })

  it('isBuildingCategory возвращает true, если активен пункт "Здание"', () => {
    const ui = new PointCounterUi(() => (key: string) => key)
    const btn = document.createElement('div')
    btn.className = 'selected'
    btn.textContent = 'Здание'
    document.body.appendChild(btn)

    expect(ui.isBuildingCategory()).toBe(true)
  })
})
