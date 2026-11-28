// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  disableNakarteControlsHiding,
  enableNakarteControlsHiding,
  NAKARTE_EMBED_CLASS,
  NAKARTE_HIDE_CONTROLS_STYLE_ID,
  NAKARTE_HIDE_CONTROLS_STYLES,
} from '@/lib/go_to_split_view'
import { INJECTED_TOKENS_ID, removeInjectedStyle } from '@/lib/injected_styles'

const styleElement = (): HTMLElement | null =>
  document.getElementById(NAKARTE_HIDE_CONTROLS_STYLE_ID)

describe('скрытие контролов Nakarte в раздельном экране', () => {
  afterEach(() => {
    disableNakarteControlsHiding()
    removeInjectedStyle(INJECTED_TOKENS_ID)
    vi.restoreAllMocks()
  })

  it('ставит маркер на корневой элемент и вставляет лист', () => {
    enableNakarteControlsHiding()

    expect(document.documentElement.classList.contains(NAKARTE_EMBED_CLASS)).toBe(true)
    expect(styleElement()?.textContent).toBe(NAKARTE_HIDE_CONTROLS_STYLES)
  })

  it('не приносит на страницу слой токенов хоста', () => {
    // Лист nakarte не читает `--nmap-*`; чужой `<style>` снять было бы нечем.
    enableNakarteControlsHiding()

    expect(document.getElementById(INJECTED_TOKENS_ID)).toBeNull()
  })

  it('повторный вызов не дублирует ни маркер, ни стиль', () => {
    enableNakarteControlsHiding()
    enableNakarteControlsHiding()

    expect(document.documentElement.classList.contains(NAKARTE_EMBED_CLASS)).toBe(true)
    expect(document.querySelectorAll(`#${NAKARTE_HIDE_CONTROLS_STYLE_ID}`)).toHaveLength(1)
  })

  it('снимает маркер и лист', () => {
    enableNakarteControlsHiding()

    disableNakarteControlsHiding()

    expect(document.documentElement.classList.contains(NAKARTE_EMBED_CLASS)).toBe(false)
    expect(styleElement()).toBeNull()
  })

  it('безопасен, если включение не выполнялось', () => {
    expect(() => disableNakarteControlsHiding()).not.toThrow()
    expect(styleElement()).toBeNull()
  })

  it('дожидается корневого элемента, если пришёл раньше него', () => {
    const rootSpy = vi
      .spyOn(document, 'documentElement', 'get')
      .mockReturnValue(null as unknown as HTMLElement)

    enableNakarteControlsHiding()
    expect(document.documentElement).toBeNull()

    rootSpy.mockRestore()
    document.dispatchEvent(new Event('DOMContentLoaded'))

    expect(document.documentElement.classList.contains(NAKARTE_EMBED_CLASS)).toBe(true)
  })

  it('отмена до появления html не оставляет отложенного маркера', () => {
    const rootSpy = vi
      .spyOn(document, 'documentElement', 'get')
      .mockReturnValue(null as unknown as HTMLElement)

    enableNakarteControlsHiding()
    disableNakarteControlsHiding()

    rootSpy.mockRestore()
    document.dispatchEvent(new Event('DOMContentLoaded'))

    expect(document.documentElement.classList.contains(NAKARTE_EMBED_CLASS)).toBe(false)
  })

  it('лист скрывает перечисленные контролы и ничего больше', () => {
    const selectors = [
      '.leaflet-bottom.leaflet-left',
      '.leaflet-bottom.leaflet-right',
      '.leaflet-control-caption',
      '.leaflet-control-scale',
      '.leaflet-search-container',
      '.leaflet-contol-panoramas',
      '.leaflet-contol-coordinates',
      '.leaflet-control-azimuth',
      '.leaflet-control-single-button',
    ]

    for (const selector of selectors) {
      // Каждое правило поднято под маркер: вне встроенного режима его нет.
      expect(NAKARTE_HIDE_CONTROLS_STYLES).toContain(`html.${NAKARTE_EMBED_CLASS} ${selector}`)
    }

    expect(NAKARTE_HIDE_CONTROLS_STYLES.match(/display:\s*none/g)).toHaveLength(1)
  })
})
