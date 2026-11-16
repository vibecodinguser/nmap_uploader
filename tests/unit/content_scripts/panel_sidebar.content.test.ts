// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import panelSidebarScript from '@/entrypoints/panel-sidebar.content'
import { NMAPS_POINT_PICKED_EVENT } from '@/lib/nmaps_pick_point_notify'
import { CLOSE_PANEL_SIDEBAR_ACTION, PANEL_SIDEBAR_WRAPPER_ID } from '@/lib/panel_sidebar_notify'
import { POINT_PICKED_ACTION, START_POINT_PICKING_ACTION } from '@/lib/pick_point_action'
import { getURL } from '@/tests/setup/browser_mock'
import { createContentScriptContext } from '@/tests/setup/content_script_context'

describe('panel-sidebar.content', () => {
  let ctx: ReturnType<typeof createContentScriptContext>
  let messageListener: ((message: { action?: string }) => void) | undefined

  beforeEach(() => {
    ctx = createContentScriptContext()
    messageListener = undefined

    vi.spyOn(browser.runtime.onMessage, 'addListener').mockImplementation((listener) => {
      messageListener = listener as (message: { action?: string }) => void
    })
    vi.mocked(getURL).mockImplementation((path: string) => {
      if (path === '/panel.html') return 'about:blank'
      const normalized = path.replace(/^\//, '')
      return `chrome-extension://test-extension-id/${normalized}`
    })
  })

  afterEach(() => {
    ctx.runInvalidated()
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  const dispatchMessage = (action: string): void => {
    expect(messageListener).toBeTypeOf('function')
    messageListener?.({ action })
  }

  it('монтирует sidebar по togglePanel', async () => {
    panelSidebarScript.main?.(ctx)

    dispatchMessage('togglePanel')
    await vi.waitFor(() => expect(document.getElementById(PANEL_SIDEBAR_WRAPPER_ID)).not.toBeNull())

    expect(getURL).toHaveBeenCalledWith('/panel.html')
    const iframe = document.querySelector(`#${PANEL_SIDEBAR_WRAPPER_ID} iframe`)
    expect(iframe).toBeInstanceOf(HTMLIFrameElement)
  })

  it('снимает sidebar при повторном togglePanel', async () => {
    panelSidebarScript.main?.(ctx)

    dispatchMessage('togglePanel')
    await vi.waitFor(() => expect(document.getElementById(PANEL_SIDEBAR_WRAPPER_ID)).not.toBeNull())

    dispatchMessage('togglePanel')
    await vi.waitFor(() => expect(document.getElementById(PANEL_SIDEBAR_WRAPPER_ID)).toBeNull())
  })

  it('закрывает sidebar по closePanelSidebar', async () => {
    panelSidebarScript.main?.(ctx)

    dispatchMessage('togglePanel')
    await vi.waitFor(() => expect(document.getElementById(PANEL_SIDEBAR_WRAPPER_ID)).not.toBeNull())

    dispatchMessage(CLOSE_PANEL_SIDEBAR_ACTION)
    expect(document.getElementById(PANEL_SIDEBAR_WRAPPER_ID)).toBeNull()
  })

  it('возвращает выбранные координаты в background вместе с меткой источника', () => {
    vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue(undefined as never)
    panelSidebarScript.main?.(ctx)

    messageListener?.({
      action: START_POINT_PICKING_ACTION,
      geomType: 'Point',
      source: 'notesPanel',
    } as never)

    document.dispatchEvent(
      new CustomEvent(NMAPS_POINT_PICKED_EVENT, {
        detail: { coords: [[55.7, 37.6]], geomType: 'Point' },
      }),
    )

    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      action: POINT_PICKED_ACTION,
      coords: [[55.7, 37.6]],
      geomType: 'Point',
      source: 'notesPanel',
    })
  })

  it('сообщает о прерванном рисовании пустым набором координат', () => {
    vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue(undefined as never)
    panelSidebarScript.main?.(ctx)

    messageListener?.({
      action: START_POINT_PICKING_ACTION,
      geomType: 'LineString',
      source: 'notesPanel',
    } as never)

    document.dispatchEvent(
      new CustomEvent(NMAPS_POINT_PICKED_EVENT, {
        detail: { coords: [], geomType: 'LineString' },
      }),
    )

    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      action: POINT_PICKED_ACTION,
      coords: [],
      geomType: 'LineString',
      source: 'notesPanel',
    })
  })
})
