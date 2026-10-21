// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAP_ELEMENT_ID, NakarteSyncService } from '@/lib/go_to_split_view'

describe('NakarteSyncService', () => {
  let service: NakarteSyncService

  beforeEach(() => {
    document.body.innerHTML = `<div id="${MAP_ELEMENT_ID}" style="width: 800px; height: 600px;"></div>`
    service = new NakarteSyncService()
  })

  afterEach(() => {
    service.stop()
    document.body.innerHTML = ''
  })

  it('находит элемент карты в DOM', () => {
    expect(service.getMapElement()).not.toBeNull()
    expect(service.getMapElement()?.id).toBe(MAP_ELEMENT_ID)
  })

  it('привязывает события мыши к элементу карты при вызове bindMapPointerEvents', () => {
    service.bindMapPointerEvents()
    const mapElement = service.getMapElement()
    expect(mapElement?.dataset.nmapUploaderPointerBound).toBe('true')
  })

  it('отправляет cursor: null родителю при handleMapMouseLeave', () => {
    const postMock = vi.fn()
    window.parent.postMessage = postMock

    service.handleMapMouseLeave()
    expect(postMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'cursor',
        location: null,
      }),
      expect.any(String),
    )
  })

  it('запускается и возвращает функцию отписки', () => {
    const cleanup = service.start()
    expect(typeof cleanup).toBe('function')
    cleanup()
  })
})
