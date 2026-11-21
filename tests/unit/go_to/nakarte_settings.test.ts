import { beforeEach, describe, expect, it } from 'vitest'
import { browser } from 'wxt/browser'
import {
  getStoredNakarteViewSettings,
  NAKARTE_SPLIT_VIEW_SETTINGS_STORAGE_KEY,
  saveNakarteViewSettings,
} from '@/lib/go_to_split_view/nakarte_settings'
import { resetBrowserMocks } from '@/tests/setup/browser_mock'

describe('nakarte settings storage', () => {
  beforeEach(async () => {
    await resetBrowserMocks()
  })

  it('возвращает пустые настройки, если ничего не сохранено', async () => {
    expect(await getStoredNakarteViewSettings()).toBe('')
  })

  it('сохраняет настройки Nakarte без положения карты', async () => {
    await saveNakarteViewSettings('#m=10/55.0/37.0&l=Otm/Y&nktp=55.7/37.6')

    const stored = await browser.storage.local.get(NAKARTE_SPLIT_VIEW_SETTINGS_STORAGE_KEY)
    expect(stored[NAKARTE_SPLIT_VIEW_SETTINGS_STORAGE_KEY]).toBe('l=Otm/Y&nktp=55.7/37.6')
    expect(await getStoredNakarteViewSettings()).toBe('l=Otm/Y&nktp=55.7/37.6')
  })

  it('очищает сохранённые настройки, если в hash осталось только положение карты', async () => {
    await saveNakarteViewSettings('#m=10/55.0/37.0&l=S/K')
    await saveNakarteViewSettings('#m=11/55.1/37.1')

    expect(await getStoredNakarteViewSettings()).toBe('')
  })
})
