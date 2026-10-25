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
  getNmapsMapViewportBounds,
  mountSplitDomElements,
  mountSplitNoticeBanner,
  setMarkerElementPosition,
  unmountSplitNoticeBanner,
  updateSplitNoticeBannerZoom,
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

  it('getNmapsMapViewportBounds возвращает реальный центр контейнера карты', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1600 })
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 900 })

    const map = document.createElement('div')
    map.className = 'nk-map'
    map.getBoundingClientRect = () => ({
      left: 100,
      top: 50,
      width: 600,
      height: 400,
      right: 700,
      bottom: 450,
      x: 100,
      y: 50,
      toJSON: () => {},
    })
    document.body.appendChild(map)

    const bounds = getNmapsMapViewportBounds()
    expect(bounds.cx).toBe(400) // 100 + 300
    expect(bounds.cy).toBe(250) // 50 + 200
  })

  it('mountSplitNoticeBanner монтирует баннер и переключает warning класс при зуме > 18', () => {
    const banner = mountSplitNoticeBanner('Тестовое сообщение', 19)
    expect(banner.textContent).toBe('Тестовое сообщение')
    expect(banner.classList.contains('nmap-uploader-split-banner--warning')).toBe(true)

    updateSplitNoticeBannerZoom(18)
    expect(banner.classList.contains('nmap-uploader-split-banner--warning')).toBe(false)

    updateSplitNoticeBannerZoom(20)
    expect(banner.classList.contains('nmap-uploader-split-banner--warning')).toBe(true)

    unmountSplitNoticeBanner()
    expect(document.getElementById('nmapUploaderSplitBanner')).toBeNull()
  })
})
