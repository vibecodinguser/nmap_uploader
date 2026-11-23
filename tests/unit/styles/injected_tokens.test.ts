import { describe, expect, it } from 'vitest'
import {
  FEED_POPUP_MENU_STYLES,
  FEED_SELECT_BUTTON_STYLES,
} from '@/lib/feeds_filter/dropdown_styles'
import { GO_TO_SPLIT_STYLES, GO_TO_STYLES } from '@/lib/go_to/styles_css'
import { INJECTED_TOKENS_CSS } from '@/lib/injected_styles'
import { NOTES_PANEL_STYLES } from '@/lib/notes_panel/styles'
import { TRACKER_STYLES } from '@/lib/object_tracker/ui/styles'

/**
 * Целостность словаря `--nmap-*` в инжектируемом слое.
 *
 * Токен, который пишут, но никто не читает, — это мёртвая запись: код
 * выглядит рабочим, а на вид ничего не влияет. Именно так разъехались имена
 * `--nmap-feeds-popup-*` (писала JS) и `--nmap-popup-*` (читал CSS): попап
 * ленты оставался тёмным во всех темах, хотя код «переключал» палитру.
 */
const SHEETS: Record<string, string> = {
  tokens: INJECTED_TOKENS_CSS,
  'object-tracker': TRACKER_STYLES,
  'feeds-select': FEED_SELECT_BUTTON_STYLES,
  'feeds-popup': FEED_POPUP_MENU_STYLES,
  'go-to': GO_TO_STYLES,
  'go-to-split': GO_TO_SPLIT_STYLES,
  'notes-panel': NOTES_PANEL_STYLES,
}

/** Объявленные токены: `--nmap-x:` в листах. */
const declaredTokens = (): Set<string> => {
  const found = new Set<string>()
  for (const css of Object.values(SHEETS)) {
    for (const match of css.matchAll(/(--nmap-[a-z0-9-]+)\s*:/g)) {
      found.add(match[1])
    }
  }
  return found
}

/** Прочитанные токены: `var(--nmap-x` в листах. */
const readTokens = (): Set<string> => {
  const found = new Set<string>()
  for (const css of Object.values(SHEETS)) {
    for (const match of css.matchAll(/var\(\s*(--nmap-[a-z0-9-]+)/g)) {
      found.add(match[1])
    }
  }
  return found
}

/**
 * Токены, которые приходят из рантайма (`syncFilterDropdownHeight` копирует
 * геометрию и цвет нативной кнопки). Их объявляет не CSS, а код на странице,
 * поэтому у них есть запасное значение в `var()`.
 *
 * Список закрытый: новый рантайм-токен добавляется сюда вместе с причиной.
 */
const RUNTIME_TOKENS = new Set([
  '--nmap-feeds-select-bg',
  '--nmap-feeds-select-border',
  '--nmap-feeds-select-color',
  '--nmap-feeds-select-focus-bg',
  '--nmap-feeds-select-height',
  '--nmap-feeds-select-hover-bg',
  '--nmap-feeds-select-hover-border',
  '--nmap-feeds-select-radius',
  '--nmap-feeds-select-tick',
])

describe('словарь --nmap-*', () => {
  it('каждый читаемый токен объявлен или приходит из рантайма', () => {
    const declared = declaredTokens()
    const orphans = [...readTokens()].filter(
      (token) => !declared.has(token) && !RUNTIME_TOKENS.has(token),
    )
    expect(orphans).toEqual([])
  })

  it('каждый объявленный токен кем-то читается', () => {
    const read = readTokens()
    const unused = [...declaredTokens()].filter((token) => !read.has(token))
    expect(unused).toEqual([])
  })

  it('рантайм-токены действительно читаются в CSS', () => {
    const read = readTokens()
    const stale = [...RUNTIME_TOKENS].filter((token) => !read.has(token))
    expect(stale).toEqual([])
  })
})

describe('тема попапа ленты', () => {
  it('светлая палитра включается классом темы редактора', () => {
    expect(INJECTED_TOKENS_CSS).toContain('.nk-page_color-scheme_light')
  })

  it('для режима «как в системе» есть медиазапрос', () => {
    expect(INJECTED_TOKENS_CSS).toMatch(/@media\s*\(prefers-color-scheme:\s*light\)/)
  })

  it('попап читает палитру из токенов, а не из литералов', () => {
    // Раньше фон был жёстко #333333 и попап не следовал теме.
    expect(FEED_POPUP_MENU_STYLES).toContain('var(--nmap-popup-bg)')
    expect(FEED_POPUP_MENU_STYLES).toContain('var(--nmap-popup-text)')
    expect(FEED_POPUP_MENU_STYLES).not.toContain('rgba(255, 255, 255, 0.1)')
  })

  it('селект не держит белых рамок, невидимых в светлой теме', () => {
    expect(FEED_SELECT_BUTTON_STYLES).not.toContain('rgba(255, 255, 255, 0.4)')
    expect(FEED_SELECT_BUTTON_STYLES).not.toContain('rgba(255, 255, 255, 0.08)')
  })
})
