// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import mapPointCounterScript from '@/entrypoints/map-point-counter.content'
import { createContentScriptContext } from '@/tests/setup/content_script_context'

describe('map-point-counter.content', () => {
  let ctx: ReturnType<typeof createContentScriptContext>

  beforeEach(() => {
    ctx = createContentScriptContext()
    document.documentElement.lang = 'ru'
  })

  afterEach(() => {
    ctx.runInvalidated()
    document.body.replaceChildren()
    document.head.replaceChildren()
    document.title = ''
    vi.restoreAllMocks()
  })

  it('создает UI счетчика при запуске', () => {
    mapPointCounterScript.main?.(ctx)
    const wrapper = document.getElementById('nmap-point-counter-wrapper')
    expect(wrapper).not.toBeNull()
    expect(wrapper?.style.display).toBe('none')
  })

  it('скрывает счетчик для зданий (если категория выделена)', async () => {
    // Имитируем, что выбрана категория Здание
    const sidebar = document.createElement('div')
    sidebar.className = 'nk-sidebar-view'

    const activeBtn = document.createElement('div')
    activeBtn.className = 'is-active'
    activeBtn.textContent = 'Здание'
    sidebar.appendChild(activeBtn)
    document.body.appendChild(sidebar)

    mapPointCounterScript.main?.(ctx)

    const wrapper = document.getElementById('nmap-point-counter-wrapper')

    // Имитируем добавление линии
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', 'M0 0 L10 10 L20 20') // 3 точки
    svg.appendChild(path)
    document.body.appendChild(svg)

    // Даем MutationObserver отработать
    await new Promise((r) => setTimeout(r, 0))

    // Изменяем путь, чтобы сработал счетчик
    path.setAttribute('d', 'M0 0 L10 10 L20 20 L30 30') // 4 точки
    await new Promise((r) => setTimeout(r, 0))

    // Поскольку выбрано здание, счетчик должен остаться скрытым
    expect(wrapper?.style.display).toBe('none')
  })

  it('показывает счетчик для обычных контуров (лимит 500)', async () => {
    mapPointCounterScript.main?.(ctx)

    const wrapper = document.getElementById('nmap-point-counter-wrapper')
    const textSpan = wrapper?.querySelector('span')

    // Имитируем добавление линии (кандидат <= 3 точек)
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', 'M0 0 L10 10') // 2 точки
    svg.appendChild(path)
    document.body.appendChild(svg)

    await new Promise((r) => setTimeout(r, 0))

    // Добавляем еще точки
    path.setAttribute('d', 'M0 0 L10 10 L20 20 L30 30') // 4 точки
    await new Promise((r) => setTimeout(r, 0))

    expect(wrapper?.style.display).toBe('block')
    expect(textSpan?.textContent).toBe('Точек осталось: 496')
  })
})
