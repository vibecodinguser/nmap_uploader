// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  CURSOR_MARKER_CLASS,
  CURSOR_MARKER_REMOTE_CLASS,
  CURSOR_MARKER_VISIBLE_CLASS,
  SPLIT_RESIZED_ATTR,
  SPLIT_ROOT_ID,
} from '@/lib/go_to_split_view/core'
import {
  applyNakRootResize,
  applySplitLayout,
  clearNakRootResize,
  clearSplitLayout,
  createCursorOverlay,
  mountSplitDomElements,
  setMarkerElementPosition,
} from '@/lib/go_to_split_view/dom'
import { GO_TO_SPLIT_ACTIVE_CLASS } from '@/lib/go_to_styles'

describe('go_to_split_view/dom', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    document.documentElement.className = ''
    document.documentElement.style.overflow = ''
    document.body.style.overflow = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('createCursorOverlay создает элемент оверлея с маркером', () => {
    const overlay = createCursorOverlay('test-overlay', true)
    expect(overlay.className).toBe('test-overlay')
    expect(overlay.firstElementChild?.className).toContain(CURSOR_MARKER_CLASS)
    expect(overlay.firstElementChild?.className).toContain(CURSOR_MARKER_REMOTE_CLASS)
  })

  it('setMarkerElementPosition корректно выставляет left/top и класс видимости', () => {
    const marker = document.createElement('div')

    setMarkerElementPosition(marker, { x: 120, y: 80 })
    expect(marker.style.left).toBe('120px')
    expect(marker.style.top).toBe('80px')
    expect(marker.classList.contains(CURSOR_MARKER_VISIBLE_CLASS)).toBe(true)

    setMarkerElementPosition(marker, null)
    expect(marker.style.left).toBe('')
    expect(marker.style.top).toBe('')
    expect(marker.classList.contains(CURSOR_MARKER_VISIBLE_CLASS)).toBe(false)
  })

  it('applyNakRootResize и clearNakRootResize изменяют и восстанавливают стили редактора', () => {
    const el = document.createElement('div')
    el.className = 'nk-app-view'
    el.style.width = '1000px'
    el.style.maxWidth = '1200px'
    document.body.appendChild(el)

    const resizedElements: Array<{ element: HTMLElement; width: string; maxWidth: string }> = []
    applyNakRootResize(resizedElements)

    expect(el.style.width).toBe('50vw')
    expect(el.style.maxWidth).toBe('50vw')
    expect(el.hasAttribute(SPLIT_RESIZED_ATTR)).toBe(true)

    clearNakRootResize(resizedElements)
    expect(el.style.width).toBe('1000px')
    expect(el.style.maxWidth).toBe('1200px')
    expect(el.hasAttribute(SPLIT_RESIZED_ATTR)).toBe(false)
  })

  it('applySplitLayout и clearSplitLayout переключают стили overflow и класс активности', () => {
    const state = applySplitLayout()
    expect(document.documentElement.classList.contains(GO_TO_SPLIT_ACTIVE_CLASS)).toBe(true)
    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(document.body.style.overflow).toBe('hidden')

    clearSplitLayout(state)
    expect(document.documentElement.classList.contains(GO_TO_SPLIT_ACTIVE_CLASS)).toBe(false)
  })

  it('mountSplitDomElements монтирует iframe и оверлеи в DOM', () => {
    const dom = mountSplitDomElements('https://nakarte.me/#test')
    expect(document.getElementById(SPLIT_ROOT_ID)).toBe(dom.splitRoot)
    expect(dom.iframe.src).toBe('https://nakarte.me/#test')
    expect(dom.leftOverlay.isConnected).toBe(true)
    expect(dom.splitRoot.isConnected).toBe(true)
  })
})
