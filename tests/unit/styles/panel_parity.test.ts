// @vitest-environment node

/**
 * Инварианты паритета панели с нативным редактором.
 *
 * `docs/checklists/panel-parity.md` объявляет правила, а этот тест не даёт им
 * тихо разойтись: панель долго жила с разным фоном в Chrome и Firefox и с
 * размерами шрифта в трёх видах записи (`rem`, сырые `px`, токены).
 */
import { describe, expect, it } from 'vitest'
import dialogCss from '@/assets/styles/notes_panel/dialog.css?inline'
import groupHeaderCss from '@/assets/styles/notes_panel/group_header.css?inline'
import layoutCss from '@/assets/styles/notes_panel/layout.css?inline'
import noteListCss from '@/assets/styles/notes_panel/note_list.css?inline'
import notePropertiesCss from '@/assets/styles/notes_panel/note_properties.css?inline'
import pickersCss from '@/assets/styles/notes_panel/pickers.css?inline'
import notesPanelCss from '@/assets/styles/notes_panel.css?inline'
import themeTokensCss from '@/assets/styles/theme_tokens.css?inline'
import uploaderCss from '@/assets/styles/uploader.css?inline'

const PANEL_SHEETS: Record<string, string> = {
  'uploader.css': uploaderCss,
  'theme_tokens.css': themeTokensCss,
  'notes_panel.css': notesPanelCss,
  'notes_panel/layout.css': layoutCss,
  'notes_panel/note_list.css': noteListCss,
  'notes_panel/note_properties.css': notePropertiesCss,
  'notes_panel/pickers.css': pickersCss,
  'notes_panel/group_header.css': groupHeaderCss,
  'notes_panel/dialog.css': dialogCss,
}

/**
 * Размеры глифов. Это не текст: иконки рисуются по месту и не подчиняются
 * типографической шкале редактора.
 */
const GLYPH_SIZES = new Set(['18px', '22px'])

const fontSizesOf = (css: string): string[] =>
  [...css.matchAll(/font-size:\s*([^;]+);/g)].map((match) => match[1].trim())

/** Текст без комментариев: инварианты действуют на правила, а не на прозу. */
const withoutComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '')

describe('паритет панели с редактором', () => {
  it('не содержит браузерных развилок', () => {
    const offenders = Object.entries(PANEL_SHEETS)
      .filter(([, css]) => /-moz-appearance|browser-firefox/.test(withoutComments(css)))
      .map(([name]) => name)
    expect(offenders).toEqual([])
  })

  it('не задаёт размер шрифта литералом', () => {
    const offenders: string[] = []
    for (const [name, css] of Object.entries(PANEL_SHEETS)) {
      for (const value of fontSizesOf(withoutComments(css))) {
        const isToken = value.startsWith('var(--')
        const isInherited = value === 'inherit'
        if (!isToken && !isInherited && !GLYPH_SIZES.has(value)) {
          offenders.push(`${name}: font-size: ${value}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('объявляет все токены, на которые ссылаются листы панели', () => {
    const declared = new Set(
      [...themeTokensCss.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((match) => match[1]),
    )
    const notesDeclared = new Set(
      [
        ...Object.values(PANEL_SHEETS)
          .join('\n')
          .matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm),
      ].map((match) => match[1]),
    )
    /*
     * Часть токенов приходит в рантайме: типографика `nk-user-bar` снимается
     * с хоста (`lib/nk_user_bar_typography.ts`), локальные `--check-*` и
     * `--rdp-*` объявлены внутри своих правил, а `--notes-*` — в токенах заметок.
     */
    const runtimeProvided = new Set([
      '--control',
      '--nk-user-bar-font-size',
      '--nk-user-bar-line-height',
      '--nk-user-bar-font-weight',
      '--nk-user-bar-font-family',
    ])
    const localScope = /^--(check-|rdp-|notes-|text-)/

    const missing: string[] = []
    for (const [name, css] of Object.entries(PANEL_SHEETS)) {
      for (const match of css.matchAll(/var\((--[a-z0-9-]+)/g)) {
        const token = match[1]
        if (declared.has(token) || notesDeclared.has(token)) continue
        if (runtimeProvided.has(token) || localScope.test(token)) continue
        missing.push(`${name}: ${token}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('держит единый тёмный фон для всех браузеров', () => {
    expect(themeTokensCss).toContain('--dark-surface: #333333;')
    expect(themeTokensCss).not.toContain('#3c3c3c')
  })
})
