// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createNspdUploadButton,
  findCadastralElements,
  NSPD_ACTION_BUTTON_CLASS,
  NSPD_FLOATING_WIDGET_ID,
  scanAndMountNspdButtons,
  updateFloatingWidget,
} from '@/lib/nspd/dom_injector'

describe('NSPD dom injector', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('создает кнопку загрузки с классом и разметкой', () => {
    const fn = vi.fn()
    const btn = createNspdUploadButton(fn)
    expect(btn.className).toBe(NSPD_ACTION_BUTTON_CLASS)
    expect(btn.textContent).toContain('В Блокнот картографа')

    btn.click()
    expect(fn).toHaveBeenCalled()
  })

  it('находит элементы с кадастровым номером через TreeWalker без ложных срабатываний на root', () => {
    const root = document.createElement('div')
    root.id = 'app'
    root.innerHTML = `
      <div class="sidebar">
        <div class="card">
          <span class="label">Кадастровый номер:</span>
          <span class="value">77:01:0001001:1234</span>
        </div>
      </div>
    `
    document.body.appendChild(root)

    const items = findCadastralElements()
    expect(items).toHaveLength(1)
    expect(items[0].cadNum).toBe('77:01:0001001:1234')
    expect(items[0].element.className).toBe('value')
  })

  it('монтирует кнопку в карточку рядом с кадастровым номером и создает плавающий виджет', () => {
    const card = document.createElement('div')
    card.className = 'pkk-card'
    card.innerHTML = `<p class="cn">77:01:0001001:555</p>`
    document.body.appendChild(card)

    const mounted = scanAndMountNspdButtons()
    expect(mounted).toBe(1)

    // Кнопка в карточке
    expect(card.querySelector(`.${NSPD_ACTION_BUTTON_CLASS}`)).not.toBeNull()

    // Плавающий виджет
    const floating = document.getElementById(NSPD_FLOATING_WIDGET_ID)
    expect(floating).not.toBeNull()
    expect(floating?.textContent).toContain('77:01:0001001:555')
  })

  it('обновляет плавающий виджет', () => {
    updateFloatingWidget('23:49:0101001:10')
    const widget = document.getElementById(NSPD_FLOATING_WIDGET_ID)
    expect(widget).not.toBeNull()
    expect(widget?.textContent).toContain('23:49:0101001:10')

    updateFloatingWidget(null)
    expect(widget?.style.display).toBe('flex')
    expect(widget?.textContent).toContain('В Блокнот картографа')
    expect(widget?.style.left).toBe('50%')
    expect(widget?.style.transform).toBe('translateX(-50%)')
  })
})
