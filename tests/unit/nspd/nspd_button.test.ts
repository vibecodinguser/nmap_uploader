// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { buildNspdMapUrl, createNspdButton, NSPD_BUTTON_ID } from '@/lib/nspd/nspd_button'

describe('NSPD button', () => {
  it('создает элемент кнопки с правильным id и структурой', () => {
    const button = createNspdButton('Открыть в НСПД')
    expect(button.id).toBe(NSPD_BUTTON_ID)
    expect(button.getAttribute('aria-label')).toBe('Открыть в НСПД')
    expect(button.querySelector('svg')).not.toBeNull()
  })

  it('формирует правильный URL для перехода на nspd.gov.ru с координатами Mercator', () => {
    const nmapsUrl = 'https://n.maps.yandex.ru/#!?z=15&ll=39.81056%2C45.18567&l=nk%23sat'
    const nspdUrl = buildNspdMapUrl(nmapsUrl)

    expect(nspdUrl).not.toBeNull()
    const url = new URL(nspdUrl!)
    expect(url.origin).toBe('https://nspd.gov.ru')
    expect(url.pathname).toBe('/map')
    expect(url.searchParams.get('thematic')).toBe('PKK')
    expect(url.searchParams.get('theme_id')).toBe('1')
    expect(url.searchParams.get('baseLayerId')).toBe('235')
    expect(url.searchParams.get('active_layers')).toBe('875831')
    expect(url.searchParams.get('zoom')).toBe('15')
    expect(Number(url.searchParams.get('coordinate_x'))).toBeGreaterThan(4_000_000)
    expect(Number(url.searchParams.get('coordinate_y'))).toBeGreaterThan(5_000_000)
  })

  it('возвращает null для некорректного URL', () => {
    expect(buildNspdMapUrl('https://n.maps.yandex.ru/')).toBeNull()
    expect(buildNspdMapUrl('invalid-url')).toBeNull()
  })

  it('по умолчанию кнопка выключена и сохраняет измененное значение', async () => {
    const { getStoredNspdButtonEnabled, setStoredNspdButtonEnabled } = await import(
      '@/lib/nspd/nspd_button'
    )
    const { browser } = await import('wxt/browser')
    await browser.storage.local.clear()

    expect(await getStoredNspdButtonEnabled()).toBe(false)

    await setStoredNspdButtonEnabled(true)
    expect(await getStoredNspdButtonEnabled()).toBe(true)

    await setStoredNspdButtonEnabled(false)
    expect(await getStoredNspdButtonEnabled()).toBe(false)
  })
})
