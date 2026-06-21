// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  hideGoToTooltip,
  isElementDescendantToOrEquals,
  queryAllByDomId,
  runWhenAnyElementExists,
  runWhenElementExists,
  showGoToTooltip,
} from '@/lib/go_to_dom'
import { GO_TO_POPUP_VISIBLE_CLASS } from '@/lib/go_to_styles'

const TOOLTIP_ID = 'nmapUploaderGoToTooltip'

const createAlignTarget = (rect: DOMRect): HTMLElement => {
  const target = document.createElement('button')
  target.id = 'alignTarget'
  target.getBoundingClientRect = () => rect
  document.body.appendChild(target)
  return target
}

describe('queryAllByDomId', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('находит все элементы с заданным id', () => {
    const first = document.createElement('div')
    first.id = 'dup'
    const second = document.createElement('span')
    second.id = 'dup'
    document.body.append(first, second)

    expect(queryAllByDomId('dup')).toHaveLength(2)
  })
})

describe('isElementDescendantToOrEquals', () => {
  it('возвращает true для элемента и его потомков', () => {
    const parent = document.createElement('div')
    parent.id = 'parent'
    const child = document.createElement('span')
    parent.appendChild(child)

    expect(isElementDescendantToOrEquals(parent, 'parent')).toBe(true)
    expect(isElementDescendantToOrEquals(child, 'parent')).toBe(true)
  })

  it('возвращает false для чужого элемента', () => {
    const other = document.createElement('div')
    expect(isElementDescendantToOrEquals(other, 'parent')).toBe(false)
    expect(isElementDescendantToOrEquals(null, 'parent')).toBe(false)
  })
})

describe('runWhenElementExists', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('вызывает callback сразу, если элемент уже в DOM', () => {
    const target = document.createElement('div')
    target.className = 'target'
    document.body.appendChild(target)

    const callback = vi.fn()
    runWhenElementExists('.target', callback)

    expect(callback).toHaveBeenCalledWith(target)
  })

  it('ждёт появления элемента через MutationObserver', async () => {
    const callback = vi.fn()
    runWhenElementExists('.late-target', callback)

    const target = document.createElement('div')
    target.className = 'late-target'
    document.body.appendChild(target)

    await vi.waitFor(() => expect(callback).toHaveBeenCalledWith(target))
  })
})

describe('runWhenAnyElementExists', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('находит первый подходящий селектор', () => {
    const second = document.createElement('div')
    second.className = 'second'
    document.body.appendChild(second)

    const callback = vi.fn()
    runWhenAnyElementExists(['.missing', '.second'], callback)

    expect(callback).toHaveBeenCalledWith(second)
  })
})

describe('showGoToTooltip / hideGoToTooltip', () => {
  afterEach(() => {
    hideGoToTooltip()
    document.getElementById(TOOLTIP_ID)?.remove()
    document.body.replaceChildren()
  })

  it('создаёт тултип с .nmap-uploader-popup__content и показывает текст', () => {
    const target = createAlignTarget(new DOMRect(100, 200, 40, 32))

    showGoToTooltip('Внешние геосервисы', target, 'top')

    const tooltip = document.getElementById(TOOLTIP_ID)
    const content = tooltip?.querySelector('.nmap-uploader-popup__content')

    expect(tooltip?.classList.contains('nmap-uploader-popup--tooltip')).toBe(true)
    expect(tooltip?.getAttribute('role')).toBe('tooltip')
    expect(content).not.toBeNull()
    expect(content?.textContent).toBe('Внешние геосервисы')
    expect(tooltip?.classList.contains(GO_TO_POPUP_VISIBLE_CLASS)).toBe(true)
  })

  it('переиспользует один и тот же элемент тултипа', () => {
    const target = createAlignTarget(new DOMRect(0, 0, 20, 20))

    showGoToTooltip('Первый', target, 'top')
    const first = document.getElementById(TOOLTIP_ID)

    showGoToTooltip('Второй', target, 'top')
    const second = document.getElementById(TOOLTIP_ID)

    expect(second).toBe(first)
    expect(second?.querySelector('.nmap-uploader-popup__content')?.textContent).toBe('Второй')
    expect(document.querySelectorAll(`#${TOOLTIP_ID}`)).toHaveLength(1)
  })

  it('позиционирует тултип сверху относительно якоря', () => {
    Object.defineProperty(document.documentElement, 'offsetWidth', {
      configurable: true,
      value: 2000,
    })

    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    rectSpy.mockImplementation(function (this: HTMLElement) {
      if (this.id === 'alignTarget') return new DOMRect(100, 200, 40, 32)
      if (this.id === TOOLTIP_ID) {
        const left = Number.parseFloat(this.style.left)
        const top = Number.parseFloat(this.style.top)
        return new DOMRect(
          Number.isFinite(left) ? left : 0,
          Number.isFinite(top) ? top : 0,
          120,
          24,
        )
      }
      return new DOMRect(0, 0, 0, 0)
    })

    const target = createAlignTarget(new DOMRect(100, 200, 40, 32))
    showGoToTooltip('Подсказка', target, 'top')

    const tooltip = document.getElementById(TOOLTIP_ID)
    expect(tooltip?.style.left).toBe('100px')
    expect(tooltip?.style.top).toBe('171px')

    rectSpy.mockRestore()
  })

  it('hideGoToTooltip скрывает тултип и очищает текст', () => {
    const target = createAlignTarget(new DOMRect(10, 10, 20, 20))

    showGoToTooltip('Подсказка', target, 'top')
    hideGoToTooltip()

    const tooltip = document.getElementById(TOOLTIP_ID)
    const content = tooltip?.querySelector('.nmap-uploader-popup__content')

    expect(tooltip?.classList.contains(GO_TO_POPUP_VISIBLE_CLASS)).toBe(false)
    expect(content?.textContent).toBe('')
  })
})
