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
