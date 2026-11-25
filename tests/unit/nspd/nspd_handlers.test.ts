import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import * as diskAccessModule from '@/lib/background/disk_access'
import {
  handleCloseCurrentTab,
  handleUploadNspdGeoJson,
  processUploadNspdGeoJson,
} from '@/lib/background/nspd_handlers'
import * as uploadServiceModule from '@/lib/upload_service'

describe('NSPD background handlers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('возвращает AUTH_REQUIRED если пользователь не авторизован', async () => {
    vi.spyOn(diskAccessModule, 'resolveDiskAccess').mockResolvedValue({
      ok: false,
      error: 'AUTH_REQUIRED',
    })
    const sendResponse = vi.fn()

    await processUploadNspdGeoJson(
      {
        geojson: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [37.6, 55.7] },
              properties: {},
            },
          ],
        },
        name: 'test',
      },
      sendResponse,
    )

    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: 'AUTH_REQUIRED',
    })
  })

  it('успешно загружает валидный GeoJSON когда авторизован', async () => {
    vi.spyOn(diskAccessModule, 'resolveDiskAccess').mockResolvedValue({
      ok: true,
      token: 'fake-token',
      userId: 'user1',
    })

    vi.spyOn(uploadServiceModule, 'uploadProcessedFilesToYandexDisk').mockResolvedValue({
      ok: true,
      logs: [],
      processedCount: 1,
      skippedCount: 0,
    })

    const sendResponse = vi.fn()

    await processUploadNspdGeoJson(
      {
        geojson: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [37.6, 55.7] },
              properties: { name: '77:01:0001001:10' },
            },
          ],
        },
        name: '77_01_0001001_10',
      },
      sendResponse,
    )

    expect(sendResponse).toHaveBeenCalledWith({ ok: true })
  })

  it('отклоняет вызов от недоверенного источника', () => {
    const sendResponse = vi.fn()
    const sender = {
      id: 'foreign-extension',
      tab: { url: 'https://evil.com/' },
    }

    handleUploadNspdGeoJson({ action: 'UPLOAD_NSPD_GEOJSON' }, sender, sendResponse)
    expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: 'ACCESS_DENIED' })
  })

  it('закрывает вкладку и фокусирует вкладку НЯК', async () => {
    vi.spyOn(browser.tabs, 'query').mockImplementation(
      async () => [{ id: 101, windowId: 1, url: 'https://n.maps.yandex.ru/#!' }] as any,
    )
    const updateSpy = vi.spyOn(browser.tabs, 'update').mockResolvedValue({} as any)
    const removeSpy = vi.spyOn(browser.tabs, 'remove').mockResolvedValue(undefined)
    const sendResponse = vi.fn()

    const sender = {
      id: browser.runtime.id,
      tab: { id: 202, url: 'https://nspd.gov.ru/map' },
    }

    handleCloseCurrentTab({}, sender, sendResponse)
    await vi.waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(101, { active: true })
      expect(removeSpy).toHaveBeenCalledWith(202)
      expect(sendResponse).toHaveBeenCalledWith({ ok: true })
    })
  })
})
