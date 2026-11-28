import { describe, expect, it } from 'vitest'
import { CUT_TOAST_CSS, CUT_TOAST_ID, CUT_TOAST_STYLE_ID } from '@/lib/cut/toast'
import {
  FEED_POPUP_MENU_STYLES,
  FEED_SELECT_BUTTON_STYLES,
} from '@/lib/feeds_filter/dropdown_styles'
import { GO_TO_STYLES } from '@/lib/go_to/styles_css'
import { NAKARTE_HIDE_CONTROLS_STYLES } from '@/lib/go_to_split_view/nakarte_embed_styles'
import { NOTES_EDIT_BUTTON_ID, NOTES_EDIT_BUTTON_WRAPPER_ID } from '@/lib/notes_panel/edit_button'
import {
  NOTES_PANEL_FRAME_ID,
  NOTES_PANEL_HANDLE_ID,
  NOTES_PANEL_HOST_ID,
} from '@/lib/notes_panel/host'
import { NOTES_PANEL_STYLES } from '@/lib/notes_panel/styles'
import { TRACKER_STYLES } from '@/lib/object_tracker/ui/styles'

/**
 * Связь «имя в разметке ↔ имя в CSS».
 *
 * Переименование `nmap-* → yamapper-*` прошло по CSS и по большинству кода, но
 * константы заметок, тоста и часть id из старой партии остались на `nmap-`.
 * Элемент создавался с одним id, а правила искали другой: стили уходили в
 * пустоту. Тесты этого не видели — они проверяли текст CSS и текст константы
 * по отдельности, но не их совпадение.
 *
 * Токены `--nmap-*` сюда не относятся: у них свой словарь и своё решение.
 */
const STYLED = {
  [NOTES_PANEL_HOST_ID]: { css: NOTES_PANEL_STYLES, kind: 'id' },
  [NOTES_PANEL_FRAME_ID]: { css: NOTES_PANEL_STYLES, kind: 'id' },
  [NOTES_PANEL_HANDLE_ID]: { css: NOTES_PANEL_STYLES, kind: 'id' },
  [NOTES_EDIT_BUTTON_ID]: { css: NOTES_PANEL_STYLES, kind: 'id' },
  [NOTES_EDIT_BUTTON_WRAPPER_ID]: { css: NOTES_PANEL_STYLES, kind: 'class' },
  [CUT_TOAST_ID]: { css: CUT_TOAST_CSS, kind: 'id' },
} as const

describe('имена в разметке совпадают с именами в CSS', () => {
  it.each(Object.entries(STYLED))('%s оформлен своим листом', (name, { css, kind }) => {
    expect(css).toContain(kind === 'id' ? `#${name}` : `.${name}`)
  })

  it('id контейнера стилей тоже на новом префиксе', () => {
    // По этому id стиль снимается при teardown: рассинхрон оставил бы
    // `<style>` на странице навсегда.
    expect(CUT_TOAST_STYLE_ID).toBe(`${CUT_TOAST_ID}-style`)
  })
})

describe('переименование доведено до конца', () => {
  const sheets = {
    'notes-panel': NOTES_PANEL_STYLES,
    'cut-toast': CUT_TOAST_CSS,
    'feeds-popup': FEED_POPUP_MENU_STYLES,
    'feeds-select': FEED_SELECT_BUTTON_STYLES,
    'go-to': GO_TO_STYLES,
    'nakarte-embed': NAKARTE_HIDE_CONTROLS_STYLES,
    'object-tracker': TRACKER_STYLES,
  }

  it.each(Object.entries(sheets))('%s не содержит id на старом префиксе', (_, css) => {
    // После переименования на `yamapper-` id-селекторов на `nmap-` остаться
    // не должно. `#nmap-...` слева от `{` или `,` — это именно id, а не токен
    // вроде `#fff` (тот попадает под паттерн ниже только с `nmap-`).
    const legacyIds = [...css.matchAll(/#(nmap-[a-z0-9-]+)/g)].map((m) => m[1])
    expect(legacyIds).toEqual([])
  })
})
