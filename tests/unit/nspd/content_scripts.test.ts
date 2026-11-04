import { beforeEach, describe, expect, it } from 'vitest'
import { browser } from 'wxt/browser'
import { NSPD_HOST_PATTERNS } from '@/lib/manifest/nspd_optional_hosts'
import {
  hasNspdHostAccess,
  initNspdContentScriptSync,
  NSPD_COLLECTOR_SCRIPT_ID,
  NSPD_INTERCEPTOR_SCRIPT_ID,
  NSPD_REGISTERED_SCRIPTS,
  registerNspdContentScripts,
  requestNspdHostAccess,
  syncNspdContentScripts,
  syncNspdContentScriptsFromStorage,
  unregisterNspdContentScripts,
} from '@/lib/nspd/content_scripts'
import {
  getStoredNspdButtonEnabled,
  NSPD_BUTTON_ENABLED_STORAGE_KEY,
  setStoredNspdButtonEnabled,
} from '@/lib/nspd/nspd_button'
import { permissionsMock, resetBrowserMocks, scriptingMock } from '../../setup/browser_mock'

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('NSPD content scripts', () => {
  beforeEach(async () => {
    await resetBrowserMocks()
  })

  it('регистрирует перехватчик в MAIN world на document_start', () => {
    const interceptor = NSPD_REGISTERED_SCRIPTS.find(
      (script) => script.id === NSPD_INTERCEPTOR_SCRIPT_ID,
    )
    const collector = NSPD_REGISTERED_SCRIPTS.find(
      (script) => script.id === NSPD_COLLECTOR_SCRIPT_ID,
    )

    expect(interceptor?.world).toBe('MAIN')
    expect(interceptor?.runAt).toBe('document_start')
    expect(interceptor?.allFrames).toBe(true)
    expect(collector?.runAt).toBe('document_idle')
    expect(collector?.matches).toEqual([...NSPD_HOST_PATTERNS])
  })

  it('hasNspdHostAccess спрашивает contains с паттернами НСПД', async () => {
    permissionsMock.grant(...NSPD_HOST_PATTERNS)

    await expect(hasNspdHostAccess()).resolves.toBe(true)
    expect(permissionsMock.contains).toHaveBeenCalledWith({ origins: [...NSPD_HOST_PATTERNS] })
  })

  it('hasNspdHostAccess возвращает false без выданного доступа', async () => {
    await expect(hasNspdHostAccess()).resolves.toBe(false)
  })

  it('requestNspdHostAccess возвращает false, если API бросил ошибку', async () => {
    permissionsMock.request.mockRejectedValueOnce(new Error('user gesture required'))

    await expect(requestNspdHostAccess()).resolves.toBe(false)
  })

  it('регистрирует оба скрипта при включённой настройке и выданном доступе', async () => {
    permissionsMock.grant(...NSPD_HOST_PATTERNS)

    await syncNspdContentScripts(true)

    expect([...scriptingMock.registered.keys()].sort()).toEqual(
      [NSPD_COLLECTOR_SCRIPT_ID, NSPD_INTERCEPTOR_SCRIPT_ID].sort(),
    )
    expect(scriptingMock.registerContentScripts).toHaveBeenCalledTimes(1)
  })

  it('не регистрирует скрипты без выданного доступа', async () => {
    await syncNspdContentScripts(true)

    expect(scriptingMock.registerContentScripts).not.toHaveBeenCalled()
    expect(scriptingMock.unregisterContentScripts).not.toHaveBeenCalled()
  })

  it('снимает регистрацию при выключенной настройке', async () => {
    permissionsMock.grant(...NSPD_HOST_PATTERNS)
    await syncNspdContentScripts(true)

    await syncNspdContentScripts(false)

    expect(scriptingMock.registered.size).toBe(0)
    expect(scriptingMock.unregisterContentScripts).toHaveBeenCalledWith({
      ids: [NSPD_COLLECTOR_SCRIPT_ID, NSPD_INTERCEPTOR_SCRIPT_ID],
    })
  })

  it('повторная регистрация идемпотентна', async () => {
    permissionsMock.grant(...NSPD_HOST_PATTERNS)

    await registerNspdContentScripts()
    await registerNspdContentScripts()

    expect(scriptingMock.registerContentScripts).toHaveBeenCalledTimes(1)
  })

  it('снятие регистрации идемпотентно и не трогает чужие скрипты', async () => {
    await browser.scripting.registerContentScripts([
      { id: 'foreign-script', js: ['foreign.js'], matches: ['https://example.com/*'] },
    ])
    permissionsMock.grant(...NSPD_HOST_PATTERNS)
    await registerNspdContentScripts()

    await unregisterNspdContentScripts()
    await unregisterNspdContentScripts()

    expect(scriptingMock.unregisterContentScripts).toHaveBeenCalledTimes(1)
    expect([...scriptingMock.registered.keys()]).toEqual(['foreign-script'])
  })

  it('syncNspdContentScriptsFromStorage регистрирует скрипты по сохранённой настройке', async () => {
    permissionsMock.grant(...NSPD_HOST_PATTERNS)
    await setStoredNspdButtonEnabled(true)

    await syncNspdContentScriptsFromStorage()

    expect([...scriptingMock.registered.keys()].sort()).toEqual(
      [NSPD_COLLECTOR_SCRIPT_ID, NSPD_INTERCEPTOR_SCRIPT_ID].sort(),
    )
  })

  it('initNspdContentScriptSync регистрирует скрипты при старте background', async () => {
    permissionsMock.grant(...NSPD_HOST_PATTERNS)
    await setStoredNspdButtonEnabled(true)

    initNspdContentScriptSync()
    await flush()

    expect(scriptingMock.registered.size).toBe(2)
  })

  it('снимает скрипты и выключает настройку при отзыве доступа', async () => {
    permissionsMock.grant(...NSPD_HOST_PATTERNS)
    await setStoredNspdButtonEnabled(true)
    initNspdContentScriptSync()
    await flush()
    expect(scriptingMock.registered.size).toBe(2)

    permissionsMock.revoke(...NSPD_HOST_PATTERNS)
    await flush()

    expect(scriptingMock.registered.size).toBe(0)
    await expect(getStoredNspdButtonEnabled()).resolves.toBe(false)
  })

  it('восстанавливает регистрацию при старте background после обновления расширения', async () => {
    permissionsMock.grant(...NSPD_HOST_PATTERNS)
    await setStoredNspdButtonEnabled(true)
    // Браузер очищает динамические скрипты при обновлении расширения.
    scriptingMock.registered.clear()

    initNspdContentScriptSync()
    await flush()

    expect(scriptingMock.registered.size).toBe(2)
  })

  it('следит за настройкой: включает и выключает регистрацию', async () => {
    permissionsMock.grant(...NSPD_HOST_PATTERNS)
    initNspdContentScriptSync()
    await flush()
    expect(scriptingMock.registered.size).toBe(0)

    await browser.storage.local.set({ [NSPD_BUTTON_ENABLED_STORAGE_KEY]: true })
    await flush()
    expect(scriptingMock.registered.size).toBe(2)

    await browser.storage.local.set({ [NSPD_BUTTON_ENABLED_STORAGE_KEY]: false })
    await flush()
    expect(scriptingMock.registered.size).toBe(0)
  })

  it('выключает настройку при старте, если доступа больше нет', async () => {
    // Настройка осталась с прошлой сессии, а доступ отозван вручную.
    await setStoredNspdButtonEnabled(true)

    await syncNspdContentScriptsFromStorage()

    await expect(getStoredNspdButtonEnabled()).resolves.toBe(false)
    expect(scriptingMock.registerContentScripts).not.toHaveBeenCalled()
  })

  it('не трогает настройку при отзыве чужого доступа', async () => {
    permissionsMock.grant(...NSPD_HOST_PATTERNS)
    await setStoredNspdButtonEnabled(true)
    initNspdContentScriptSync()
    await flush()

    permissionsMock.revoke('https://example.com/*')
    await flush()

    expect(scriptingMock.registered.size).toBe(2)
    await expect(getStoredNspdButtonEnabled()).resolves.toBe(true)
  })

  it('не выключает настройку, если permissions.contains недоступен', async () => {
    await setStoredNspdButtonEnabled(true)
    permissionsMock.contains.mockRejectedValueOnce(new Error('API unavailable'))

    await syncNspdContentScriptsFromStorage()

    await expect(getStoredNspdButtonEnabled()).resolves.toBe(true)
  })

  it('снимает регистрацию при старте, если настройка выключена', async () => {
    permissionsMock.grant(...NSPD_HOST_PATTERNS)
    await registerNspdContentScripts()
    expect(scriptingMock.registered.size).toBe(2)

    await syncNspdContentScriptsFromStorage()

    expect(scriptingMock.registered.size).toBe(0)
  })

  it('терпит параллельную регистрацию, если скрипты уже зарегистрированы', async () => {
    permissionsMock.grant(...NSPD_HOST_PATTERNS)
    await registerNspdContentScripts()

    // Имитируем гонку: getRegisteredContentScripts вернул пустой список, а регистрация упала.
    scriptingMock.getRegisteredContentScripts.mockResolvedValueOnce([])
    scriptingMock.registerContentScripts.mockRejectedValueOnce(new Error('already registered'))

    await expect(registerNspdContentScripts()).resolves.toBeUndefined()
    expect(scriptingMock.registered.size).toBe(2)
  })
})
