// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GO_TO_SPLIT_BUTTON_ID } from '@/lib/go_to_split_button'
import { mountSplitDomElements } from '@/lib/go_to_split_view/dom'
import {
  readNmapsLocation,
  SplitSyncManager,
  updateSplitButtonState,
} from '@/lib/go_to_split_view/sync_manager'
import { GO_TO_SPLIT_BUTTON_ACTIVE_CLASS } from '@/lib/go_to_styles'

describe('go_to_split_view/sync_manager', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    window.location.hash = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('updateSplitButtonState корректно выставляет класс и атрибут aria-pressed', () => {
    const btn = document.createElement('button')
    btn.id = GO_TO_SPLIT_BUTTON_ID
    document.body.appendChild(btn)

    updateSplitButtonState(true)
    expect(btn.classList.contains(GO_TO_SPLIT_BUTTON_ACTIVE_CLASS)).toBe(true)
    expect(btn.getAttribute('aria-pressed')).toBe('true')

    updateSplitButtonState(false)
    expect(btn.classList.contains(GO_TO_SPLIT_BUTTON_ACTIVE_CLASS)).toBe(false)
    expect(btn.getAttribute('aria-pressed')).toBe('false')
  })

  it('readNmapsLocation возвращает локацию из текущего URL', () => {
    window.location.hash = '!/?z=15&ll=37.61,55.75'
    const loc = readNmapsLocation()
    expect(loc).toEqual({
      longitude: 37.61,
      latitude: 55.75,
      zoom: 15,
    })
  })

  it('SplitSyncManager инициализирует слушатели и корректно освобождает ресурсы при dispose', () => {
    const dom = mountSplitDomElements('https://nakarte.me')
    const initialLocation = { longitude: 37.61, latitude: 55.75, zoom: 15 }
    const manager = new SplitSyncManager(dom, initialLocation)

    manager.initListeners()
    manager.postInitialLocation()
    manager.hideCursorMarkers()

    expect(() => manager.dispose()).not.toThrow()
  })
})
