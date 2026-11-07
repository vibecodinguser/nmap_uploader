// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest'
import { getServiceButton, resolveAnchor } from '@/lib/go_to/toolbar_mount'
import { createGoToServiceButton, GO_TO_SERVICE_BUTTON_ID } from '@/lib/go_to_service_button'
import { removeAllGoToToolbarButtons } from '@/lib/go_to_toolbar'

const cleanup = (): void => {
  document.body.replaceChildren()
  document.querySelectorAll(`[id="${GO_TO_SERVICE_BUTTON_ID}"]`).forEach((element) => {
    element.remove()
  })
}

describe('go_to/toolbar_mount: принадлежность узлов', () => {
  afterEach(cleanup)

  it('не принимает чужую кнопку с нашим id за свою', () => {
    const foreign = document.createElement('a')
    foreign.id = GO_TO_SERVICE_BUTTON_ID
    const owned = createGoToServiceButton()
    document.body.append(foreign, owned)

    expect(getServiceButton()).toBe(owned)
  })

  it('не выбирает чужую go-to кнопку якорем', () => {
    const container = document.createElement('div')

    const nativeButton = document.createElement('a')
    nativeButton.className = 'nk-map-region-view__button nk-map-region-view__button_id_ymaps'
    const nativeIcon = document.createElement('span')
    nativeIcon.className = 'nk-icon nk-icon_id_ymaps'
    nativeButton.appendChild(nativeIcon)
    container.appendChild(nativeButton)

    const foreignButton = document.createElement('a')
    foreignButton.className = 'nk-map-region-view__button nk-map-region-view__button_id_goto'
    const foreignIcon = document.createElement('span')
    foreignIcon.className = 'nk-icon nk-icon_id_ymaps'
    foreignButton.appendChild(foreignIcon)
    container.appendChild(foreignButton)

    document.body.appendChild(container)

    expect(resolveAnchor()).toBe(nativeIcon)
  })

  it('удаляет только свои кнопки, не трогая чужие', () => {
    const foreign = document.createElement('a')
    foreign.id = GO_TO_SERVICE_BUTTON_ID
    const owned = createGoToServiceButton()
    document.body.append(foreign, owned)

    removeAllGoToToolbarButtons()

    expect(foreign.isConnected).toBe(true)
    expect(owned.isConnected).toBe(false)
  })
})
