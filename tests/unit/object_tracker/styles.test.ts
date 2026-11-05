// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest'
import { TRACKER_STYLES } from '@/lib/object_tracker/ui/styles'

describe('object_tracker: стили панели', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
  })

  it('не задаёт жёсткий фон: панель наследует поверхность острова', () => {
    const panelRule = TRACKER_STYLES.slice(0, TRACKER_STYLES.indexOf('.nmap-ot-header'))

    expect(panelRule).toContain('background: transparent')
    expect(panelRule).not.toContain('background: #ffffff')
  })

  it('содержит переопределения для тёмной темы редактора', () => {
    expect(TRACKER_STYLES).toContain('.nk-page_color-scheme_dark .nmap-ot-commit__object')
    expect(TRACKER_STYLES).toContain('.nk-page_color-scheme_dark .nmap-ot-status-pending')
    expect(TRACKER_STYLES).toContain('.nk-page_color-scheme_dark .nmap-ot-warning')
  })

  it('учитывает системную тёмную тему без явного класса', () => {
    expect(TRACKER_STYLES).toContain('@media (prefers-color-scheme: dark)')
  })

  it('даёт отступы между кнопками и полями', () => {
    expect(TRACKER_STYLES).toContain('.nmap-ot-add__row')
    expect(TRACKER_STYLES).toContain('gap: 8px')
    expect(TRACKER_STYLES).toContain('.nmap-ot-title-row')
  })

  it('описывает точку непрочитанного на вкладке', () => {
    expect(TRACKER_STYLES).toContain('#nmap-uploader-object-tracker-tab.nmap-ot-tab-unread::after')
  })

  it('рисует обводку фокуса на обёртке поля, а не на input', () => {
    // У нативного control своего outline нет, обводка рисуется на обёртке,
    // чтобы совпадать с рамкой nk-text-input.
    expect(TRACKER_STYLES).toContain('.nmap-ot-add__field:focus-within')
  })

  it('не переопределяет размеры и отступы нативного поля', () => {
    // Поле должно полностью повторять nk-text-input: свои height и padding
    // ломали совпадение control с рамкой ::before.
    const fieldRule = TRACKER_STYLES.match(/\.nmap-ot-add__field \{[^}]*\}/)?.[0] ?? ''

    expect(fieldRule).not.toContain('height')
    expect(fieldRule).not.toContain('padding')
    expect(fieldRule).not.toContain('display')
    expect(TRACKER_STYLES).not.toContain('.nmap-ot-add__field .nk-text-input__control')
  })
})
