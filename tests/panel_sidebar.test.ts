// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  calculateZoomFromBbox,
  checkAndNotifyTrackerDate,
  createSidebarIframeUi,
  parseCenterMapMessage,
  setTrackerDateInDom,
} from '@/lib/panel_sidebar'
import { PANEL_SIDEBAR_WRAPPER_ID } from '@/lib/panel_sidebar_notify'

describe('panel_sidebar core & dom', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  describe('calculateZoomFromBbox', () => {
    it('возвращает 17 (максимальный зум минус 1) при точечном bbox', () => {
      const zoom = calculateZoomFromBbox([37, 55, 37, 55], 1000, 800)
      expect(zoom).toBe(17)
    })

    it('вычисляет корректный зум при валидном bbox', () => {
      const zoom = calculateZoomFromBbox([37.0, 55.0, 37.5, 55.5], 1000, 800)
      expect(zoom).toBeGreaterThan(5)
      expect(zoom).toBeLessThanOrEqual(18)
    })
  })

  describe('parseCenterMapMessage', () => {
    it('возвращает null при некорректных координатах', () => {
      expect(parseCenterMapMessage({ latitude: 'invalid' })).toBeNull()
      expect(parseCenterMapMessage({})).toBeNull()
    })

    it('парсит координаты и зум', () => {
      const res = parseCenterMapMessage({ latitude: 55.75, longitude: 37.61, zoom: 15 })
      expect(res).toEqual({
        latitude: 55.75,
        longitude: 37.61,
        zoom: 15,
      })
    })

    it('парсит координаты и вычисляет зум из bbox', () => {
      const res = parseCenterMapMessage(
        { latitude: 55.75, longitude: 37.61, bbox: [37.0, 55.0, 37.5, 55.5] },
        1000,
        800,
      )
      expect(res).not.toBeNull()
      expect(res?.latitude).toBe(55.75)
      expect(res?.longitude).toBe(37.61)
      expect(res?.zoom).toBeGreaterThan(5)
    })
  })

  describe('createSidebarIframeUi', () => {
    it('создает wrapper и iframe, монтирует и удаляет их', () => {
      const getUrl = () => 'https://example.com/panel.html'
      const ui = createSidebarIframeUi(getUrl)

      expect(ui.wrapper.id).toBe(PANEL_SIDEBAR_WRAPPER_ID)
      expect(ui.iframe).not.toBeNull()

      ui.mount()
      expect(document.getElementById(PANEL_SIDEBAR_WRAPPER_ID)).not.toBeNull()
      expect(ui.iframe.src).toBe('https://example.com/panel.html')

      ui.remove()
      expect(document.getElementById(PANEL_SIDEBAR_WRAPPER_ID)).toBeNull()
    })
  })

  describe('checkAndNotifyTrackerDate', () => {
    it('находит дату и вызывает callback при обнаружении новой даты', () => {
      document.body.innerHTML = `
        <button class="nk-button__text">21.10.2026</button>
      `
      const onDateChange = vi.fn()
      const newDate = checkAndNotifyTrackerDate({ lastDate: '', onDateChange })

      expect(newDate).toBe('21.10.2026')
      expect(onDateChange).toHaveBeenCalledWith('21.10.2026')
    })

    it('не вызывает callback, если дата не изменилась', () => {
      document.body.innerHTML = `
        <button class="nk-button__text">21.10.2026</button>
      `
      const onDateChange = vi.fn()
      const newDate = checkAndNotifyTrackerDate({ lastDate: '21.10.2026', onDateChange })

      expect(newDate).toBe('21.10.2026')
      expect(onDateChange).not.toHaveBeenCalled()
    })
  })
})
