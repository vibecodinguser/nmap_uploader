// @vitest-environment node

/**
 * Инварианты паритета панели с нативным редактором.
 *
 * `docs/checklists/panel-parity.md` объявляет правила, а этот тест не даёт им
 * тихо разойтись: панель долго жила с разным фоном в Chrome и Firefox и с
 * размерами шрифта в трёх видах записи (`rem`, сырые `px`, токены).
 */
import { describe, expect, it } from 'vitest'
import nkFontsCss from '@/assets/styles/nk_fonts.css?inline'
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
  'nk_fonts.css': nkFontsCss,
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

  /*
   * В редакторе жирного начертания нет: `font-weight` в его бандле встречается
   * только у чата (`500`) и уведомлений (`700`). В нашем шрифте объявлены
   * 400/500/700, поэтому `600` браузер рисует `700`-м — «полужирный» заголовок
   * становится жирным. Тест держит правило на всех листах панели, включая
   * заметки: `600`/`700` не пишем.
   */
  it('не использует жирного начертания, которого нет в редакторе', () => {
    const offenders: string[] = []
    for (const [name, css] of Object.entries(PANEL_SHEETS)) {
      // `@font-face` объявляет начертания 400/500/700 — это не выбор веса для текста.
      const textCss = withoutComments(css).replace(/@font-face\s*\{[^}]*\}/g, '')
      for (const match of textCss.matchAll(/font-weight:\s*([^;]+);/g)) {
        const value = match[1].trim()
        if (/^(600|700|bold|bolder)$/.test(value)) offenders.push(`${name}: font-weight: ${value}`)
      }
    }

    expect(offenders).toEqual([])
  })

  /*
   * У нативного заголовка все типографические свойства — браузерные по
   * умолчанию: `-webkit-font-smoothing: auto`, `text-rendering: auto`. На macOS
   * `antialiased` отключает субпиксельное сглаживание и делает штрихи тоньше,
   * поэтому один и тот же шрифт выглядит легче нативного. Тест держит панель на
   * умолчаниях: сглаживание не переопределяем.
   */
  it('не переопределяет сглаживание шрифта', () => {
    const offenders = Object.entries(PANEL_SHEETS)
      .filter(([, css]) =>
        /(-webkit-font-smoothing|-moz-osx-font-smoothing|text-rendering)\s*:/.test(
          withoutComments(css),
        ),
      )
      .map(([name]) => name)
    expect(offenders).toEqual([])
  })

  /*
   * `react-day-picker` подключается собственным `style.css` и рисует заголовок
   * месяца и выбранный день жирным. Его правила не входят в `PANEL_SHEETS`,
   * поэтому проверяем отдельно: оба селектора переопределены на 400 в панели.
   */
  it('переопределяет жирный шрифт календаря react-day-picker', () => {
    const block =
      /\.point-date-popover \.rdp-month_caption,\s*\.point-date-popover \.rdp-selected\s*\{([^}]*)\}/.exec(
        withoutComments(uploaderCss),
      )?.[1] ?? ''
    expect(block).toContain('font-weight: 400')
  })

  /*
   * Панель живёт в iframe страницы расширения, поэтому `@font-face` редактора
   * в неё не переезжает: `--font-family` начинается с «Yandex Sans Text», и без
   * собственных правил этот первый вариант молча превращается в Arial. Тест
   * держит связь между токеном и объявлением шрифта, чтобы заголовки не начали
   * тихо отличаться от нативных.
   */
  it('объявляет веб-шрифт редактора для начертаний шкалы', () => {
    const family = /--font-family:\s*([^;]+);/.exec(themeTokensCss)?.[1].trim()
    const primary = /^"([^"]+)"/.exec(family ?? '')?.[1]
    expect(primary).toBe('Yandex Sans Text')

    const faces = [...nkFontsCss.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((match) => match[1])
    const weights = faces.map((body) => /font-weight:\s*(\d+)/.exec(body)?.[1])

    expect(weights.sort()).toEqual(['400', '500', '700'])
    for (const body of faces) {
      expect(/font-family:\s*"([^"]+)"/.exec(body)?.[1]).toBe(primary)
      expect(/url\("(https:\/\/yastatic\.net\/[^"]+\.woff2)"\)/.exec(body)?.[1]).toBeTruthy()
    }
  })
})
