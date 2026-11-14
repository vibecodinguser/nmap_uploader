// @vitest-environment node

/**
 * Страховка от массовой потери правил в `uploader.css`.
 *
 * Файл — единый лист панели расширения, и одна неудачная пакетная правка уже
 * стирала из него стили настроек и переключателей вместе с правилами заметок.
 * Снапшот здесь не годится (лист большой и меняется часто), поэтому тест
 * держит два дешёвых инварианта: объём листа и наличие ключевых селекторов.
 */
import { describe, expect, it } from 'vitest'
import uploaderCss from '@/assets/styles/uploader.css?inline'

const ruleCount = (css: string): number => (css.match(/\{/g) ?? []).length

/** Селекторы, без которых панель теряет внешний вид. */
const CRITICAL_SELECTORS = [
  '.sidepanel-app',
  '.settings-toggle',
  '.settings-go-to-panel',
  '.theme-mode-switch',
  '.yandex-tooltip-wrapper',
  '.upload-dropzone',
  '.manual-upload-container',
  '.point-tabs',
  '.tab-panel',
]

describe('uploader.css', () => {
  it('сохраняет объём правил', () => {
    // Было ~262 правила до удаления заметок; нижняя граница ловит потерю сотен строк.
    expect(ruleCount(uploaderCss)).toBeGreaterThan(200)
  })

  it('содержит все ключевые селекторы панели', () => {
    const missing = CRITICAL_SELECTORS.filter((selector) => !uploaderCss.includes(`${selector} {`))
    expect(missing).toEqual([])
  })

  it('не содержит остатков удалённого попапа заметок', () => {
    expect(uploaderCss).not.toContain('.notes-list-item')
    expect(uploaderCss).not.toContain('.notes-popup-app')
  })
})
