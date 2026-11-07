// @vitest-environment happy-dom

/**
 * Страховка для CSS, который content scripts инжектируют в страницу.
 *
 * Снапшот фиксирует нормализованный текст каждого листа (форматирование не
 * учитывается, декларации — учитываются), поэтому любое изменение внешнего
 * вида видно в diff. Отдельный бюджет ограничивает рост `!important`.
 */
import { describe, expect, it } from 'vitest'
import {
  FEED_CARD_HIDDEN_STYLES,
  FEED_POPUP_MENU_STYLES,
  FEED_SELECT_BUTTON_STYLES,
} from '@/lib/feeds_filter/dropdown_styles'
import { GO_TO_SPLIT_STYLES, GO_TO_STYLES } from '@/lib/go_to/styles_css'
import { INJECTED_TOKENS_CSS } from '@/lib/injected_styles'
import { TRACKER_STYLES } from '@/lib/object_tracker/ui/styles'
import { HIDER_CSS } from '@/lib/point_counter/banner_suppressor'
import { buildRecolorStyleSheet } from '@/lib/stroke_color/recolor_core'

/** Форматирование не должно влиять на снапшот: только правила и значения. */
const normalize = (css: string): string =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};:,])\s*/g, '$1')
    .replace(/}\s*/g, '}\n')
    .trim()

const SHEETS = {
  tokens: INJECTED_TOKENS_CSS,
  'object-tracker': TRACKER_STYLES,
  'feeds-select': FEED_SELECT_BUTTON_STYLES,
  'feeds-popup': FEED_POPUP_MENU_STYLES,
  'feeds-card-hidden': FEED_CARD_HIDDEN_STYLES,
  'go-to': GO_TO_STYLES,
  'go-to-split': GO_TO_SPLIT_STYLES,
  'banner-suppressor': HIDER_CSS,
  'stroke-recolor': buildRecolorStyleSheet('#00ff00'),
} as const

/**
 * Текущее число `!important` по листам.
 *
 * Это бюджет, а не цель: число может уменьшаться свободно, расти — только
 * осознанно, вместе с этой строкой и объяснением в коммите.
 */
const IMPORTANT_BUDGET: Record<keyof typeof SHEETS, number> = {
  tokens: 0,
  'object-tracker': 0,
  'feeds-select': 190,
  'feeds-popup': 147,
  'feeds-card-hidden': 1,
  'go-to': 15,
  'go-to-split': 6,
  'banner-suppressor': 1,
  'stroke-recolor': 1,
}

const countImportant = (css: string): number => css.match(/!important/g)?.length ?? 0

describe('инжектируемые стили', () => {
  for (const [name, css] of Object.entries(SHEETS)) {
    it(`${name}: текст не менялся`, () => {
      expect(normalize(css)).toMatchSnapshot()
    })
  }

  for (const [name, css] of Object.entries(SHEETS)) {
    it(`${name}: бюджет !important не превышен`, () => {
      expect(countImportant(css)).toBeLessThanOrEqual(IMPORTANT_BUDGET[name as keyof typeof SHEETS])
    })
  }

  it('go-to включает стили раздельного вида', () => {
    expect(GO_TO_STYLES).toContain('.nmap-uploader-split {')
  })

  it('скрытие карточек использует общий класс ленты', () => {
    expect(FEED_CARD_HIDDEN_STYLES).toContain('.nmap-uploader-feed-event-hidden')
  })

  it('скрытие баннера привязано к data-атрибуту', () => {
    expect(HIDER_CSS).toContain('html[data-nmap-hide-system-banner="true"]')
  })

  it('перекраска контура подставляет целевой цвет', () => {
    expect(buildRecolorStyleSheet('#123456')).toContain('stroke: #123456 !important')
  })

  it('каждая использованная переменная объявлена или приходит из рантайма', () => {
    const declared = new Set(
      (INJECTED_TOKENS_CSS.match(/--nmap-[a-z0-9-]+(?=\s*:)/g) ?? []).map((name) => name.trim()),
    )
    // Значения этих переменных выставляет JS по вычисленным стилям хоста.
    const runtimePrefixes = ['--nmap-feeds-select-', '--nmap-uploader-']

    const used = new Set(
      Object.values(SHEETS).flatMap(
        (css) => css.match(/var\((--nmap-[a-z0-9-]+)/g)?.map((m) => m.slice(4)) ?? [],
      ),
    )

    const unknown = [...used].filter(
      (name) => !declared.has(name) && !runtimePrefixes.some((prefix) => name.startsWith(prefix)),
    )

    expect(unknown).toEqual([])
  })
})
