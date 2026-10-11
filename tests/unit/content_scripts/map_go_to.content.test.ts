// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import mapGoToScript from '@/entrypoints/map-go-to.content'
import { GO_TO_REFRESH_ACTION } from '@/lib/go_to_notify'
import { GO_TO_SERVICE_BUTTON_ID } from '@/lib/go_to_service_button'
import { GO_TO_ITEMS_STORAGE_KEY, GO_TO_MENU_ENABLED_STORAGE_KEY } from '@/lib/go_to_settings'
import {
  GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY,
  GO_TO_SPLIT_BUTTON_ID,
} from '@/lib/go_to_split_button'
import { NOTES_BUTTON_ENABLED_STORAGE_KEY, NOTES_BUTTON_ID } from '@/lib/notes_button'
import { NOTES_POPUP_ID } from '@/lib/notes_popup'
import { POLYGON_UPLOAD_BUTTON_ID } from '@/lib/polygon_upload_button'
import { POLYGON_UPLOAD_POPUP_ID } from '@/lib/polygon_upload_popup'
import { createContentScriptContext } from '@/tests/setup/content_script_context'

const mountNmapsToolbarAnchor = (): HTMLElement => {
  const parent = document.createElement('div')
  const anchor = document.createElement('span')
  anchor.className = 'nk-icon_id_ymaps'
  parent.appendChild(anchor)
  document.body.appendChild(parent)
  return anchor
}

describe('map-go-to.content', () => {
  let ctx: ReturnType<typeof createContentScriptContext>
  let runtimeListener: ((message: { action?: string }) => void) | undefined

  beforeEach(async () => {
    ctx = createContentScriptContext()
    runtimeListener = undefined

    await browser.storage.local.set({
      [GO_TO_MENU_ENABLED_STORAGE_KEY]: true,
      [GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY]: false,
      [GO_TO_ITEMS_STORAGE_KEY]: [{ name: 'Nakarte', active: true }],
    })

    vi.spyOn(browser.runtime.onMessage, 'addListener').mockImplementation((listener) => {
      runtimeListener = listener as (message: { action?: string }) => void
    })
  })

  afterEach(() => {
    ctx.runInvalidated()
    document.body.replaceChildren()
    document.head.replaceChildren()
    vi.restoreAllMocks()
  })

  it('монтирует кнопку go-to при включённом меню', async () => {
    mountNmapsToolbarAnchor()
    mapGoToScript.main?.(ctx)

    await vi.waitFor(() => expect(document.getElementById(GO_TO_SERVICE_BUTTON_ID)).not.toBeNull())
  })

  it('оставляет кнопку загрузки при выключенных меню и split-view', async () => {
    await browser.storage.local.set({
      [GO_TO_MENU_ENABLED_STORAGE_KEY]: false,
      [GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY]: false,
    })

    mountNmapsToolbarAnchor()
    mapGoToScript.main?.(ctx)

    await vi.waitFor(() => {
      expect(document.getElementById(POLYGON_UPLOAD_BUTTON_ID)).not.toBeNull()
      expect(document.getElementById(GO_TO_SPLIT_BUTTON_ID)).toBeNull()
    })
  })

  it('перемонтирует toolbar по runtime-сообщению refresh', async () => {
    mountNmapsToolbarAnchor()
    mapGoToScript.main?.(ctx)

    await vi.waitFor(() => expect(document.getElementById(GO_TO_SERVICE_BUTTON_ID)).not.toBeNull())

    document.getElementById(GO_TO_SERVICE_BUTTON_ID)?.remove()

    runtimeListener?.({ action: GO_TO_REFRESH_ACTION })

    await vi.waitFor(() => {
      expect(document.getElementById(GO_TO_SERVICE_BUTTON_ID)).not.toBeNull()
      expect(document.querySelectorAll(`#${POLYGON_UPLOAD_BUTTON_ID}`)).toHaveLength(1)
    })
  })

  it('монтирует split-view кнопку при включённой опции', async () => {
    await browser.storage.local.set({
      [GO_TO_MENU_ENABLED_STORAGE_KEY]: true,
      [GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY]: true,
    })

    mountNmapsToolbarAnchor()
    mapGoToScript.main?.(ctx)

    await vi.waitFor(() => {
      expect(document.getElementById(GO_TO_SERVICE_BUTTON_ID)).not.toBeNull()
      expect(document.getElementById(GO_TO_SPLIT_BUTTON_ID)).not.toBeNull()
      const uploadButton = document.getElementById(POLYGON_UPLOAD_BUTTON_ID)
      expect(uploadButton).not.toBeNull()
      expect(uploadButton?.previousElementSibling?.id).toBe(GO_TO_SPLIT_BUTTON_ID)
      const notesButton = document.getElementById(NOTES_BUTTON_ID)
      expect(notesButton).not.toBeNull()
      expect(notesButton?.previousElementSibling?.id).toBe(POLYGON_UPLOAD_BUTTON_ID)
    })
  })

  it('открывает заметки справа от загрузки и закрывает попап загрузки', async () => {
    vi.spyOn(browser.runtime, 'getURL').mockReturnValue('about:blank')
    mountNmapsToolbarAnchor()
    mapGoToScript.main?.(ctx)

    await vi.waitFor(() => expect(document.getElementById(NOTES_BUTTON_ID)).not.toBeNull())

    document.getElementById(POLYGON_UPLOAD_BUTTON_ID)?.click()
    expect(document.getElementById(POLYGON_UPLOAD_POPUP_ID)).not.toBeNull()

    document.getElementById(NOTES_BUTTON_ID)?.click()
    expect(document.getElementById(POLYGON_UPLOAD_POPUP_ID)).toBeNull()
    expect(document.getElementById(NOTES_POPUP_ID)).not.toBeNull()

    document.getElementById(NOTES_BUTTON_ID)?.click()
    expect(document.getElementById(NOTES_POPUP_ID)).toBeNull()
  })

  it('открывает и закрывает popup кнопкой загрузки', async () => {
    vi.spyOn(browser.runtime, 'getURL').mockReturnValue('about:blank')
    mountNmapsToolbarAnchor()
    mapGoToScript.main?.(ctx)

    await vi.waitFor(() => expect(document.getElementById(POLYGON_UPLOAD_BUTTON_ID)).not.toBeNull())

    document.getElementById(POLYGON_UPLOAD_BUTTON_ID)?.click()
    expect(document.getElementById(POLYGON_UPLOAD_POPUP_ID)).not.toBeNull()

    document.getElementById(POLYGON_UPLOAD_BUTTON_ID)?.click()
    expect(document.getElementById(POLYGON_UPLOAD_POPUP_ID)).toBeNull()
  })

  it('не монтирует кнопку заметок при отключённой опции в хранилище', async () => {
    await browser.storage.local.set({
      [NOTES_BUTTON_ENABLED_STORAGE_KEY]: false,
    })

    mountNmapsToolbarAnchor()
    mapGoToScript.main?.(ctx)

    await vi.waitFor(() => {
      expect(document.getElementById(POLYGON_UPLOAD_BUTTON_ID)).not.toBeNull()
      expect(document.getElementById(NOTES_BUTTON_ID)).toBeNull()
    })
  })
})
