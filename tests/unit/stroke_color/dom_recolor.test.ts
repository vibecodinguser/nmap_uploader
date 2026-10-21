// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  injectRecolorStyles,
  isExtensionShadowNode,
  recolorInlineStyle,
  recolorSvgElement,
  removeRecolorStyles,
} from '@/lib/stroke_color/dom_recolor'
import { RECOLOR_MARKER, RECOLOR_STYLE_ID } from '@/lib/stroke_color/recolor_core'

describe('stroke_color/dom_recolor', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    document.head.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
    document.head.innerHTML = ''
  })

  it('injectRecolorStyles и removeRecolorStyles управляют элементом стиля', () => {
    injectRecolorStyles('#123456')
    const styleEl = document.getElementById(RECOLOR_STYLE_ID)
    expect(styleEl).not.toBeNull()
    expect(styleEl?.textContent).toContain('stroke: #123456 !important;')

    removeRecolorStyles()
    expect(document.getElementById(RECOLOR_STYLE_ID)).toBeNull()
  })

  it('recolorInlineStyle перекрашивает inline stroke и fill цвета magenta', () => {
    const inline = 'stroke: #ff00ff; fill: magenta; stroke-width: 2px;'
    const result = recolorInlineStyle(inline, '#00ff00')
    expect(result).toBe('stroke: #00ff00; fill: #00ff00; stroke-width: 2px;')

    const untouched = 'stroke: #112233; fill: none;'
    expect(recolorInlineStyle(untouched, '#00ff00')).toBeNull()
  })

  it('recolorSvgElement перекрашивает атрибуты stroke в SVGElement', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('stroke', '#ff00ff')
    svg.appendChild(path)
    document.body.appendChild(svg)

    recolorSvgElement(path, '#00aa00')
    expect(path.getAttribute('stroke')).toBe('#00aa00')
    expect(path.getAttribute(RECOLOR_MARKER)).toBe('1')
  })

  it('isExtensionShadowNode возвращает false для обычных DOM элементов', () => {
    const div = document.createElement('div')
    document.body.appendChild(div)
    expect(isExtensionShadowNode(div)).toBe(false)
  })
})
