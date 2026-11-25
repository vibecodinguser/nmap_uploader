// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useNotesButton } from '@/hooks/useNotesButton'
import { useNspdButton } from '@/hooks/useNspdButton'
import { NSPD_HOST_PATTERNS } from '@/lib/manifest/nspd_optional_hosts'
import { YANDEX_PERMISSION_REQUEST } from '@/lib/manifest/yandex_optional_hosts'
import { getStoredNspdButtonEnabled, setStoredNspdButtonEnabled } from '@/lib/nspd/nspd_button'
import { permissionsMock, resetBrowserMocks, scriptingMock } from '@/tests/setup/browser_mock'

const flushEffects = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve()
  })
}

/**
 * Регрессии ленивой авторизации.
 *
 * Обе поломки выглядели у пользователя одинаково — «ничего не происходит»:
 * заметки висли на «Разрешить доступ», а на сайте НСПД не появлялось кнопки
 * загрузки.
 *
 * Заметки: запрос разрешений шёл через контент-скрипт редактора по
 * `window.postMessage`, но `chrome.permissions` в content scripts не существует
 * (там доступны только `dom`, `i18n`, `storage` и `runtime`), да и `postMessage`
 * из окна расширения не адресуется сайту карты. Панель ждала ответа до таймаута.
 *
 * НСПД: синхронизация разрешений выключала настройку пользователя, если доступа
 * не было, а включение требовало ещё и Диск — без него скрипты не
 * регистрировались вовсе, и кнопки на сайте не было.
 */
describe('регрессии разрешений', () => {
  beforeEach(async () => {
    await resetBrowserMocks()
  })

  describe('заметки', () => {
    it('панель просит разрешения сама и сразу получает ответ', async () => {
      permissionsMock.revoke(...YANDEX_PERMISSION_REQUEST.origins)
      const { result } = renderHook(() => useNotesButton())
      await flushEffects()

      await act(async () => {
        result.current.setIsEnabled(true)
      })

      expect(permissionsMock.request).toHaveBeenCalledWith(YANDEX_PERMISSION_REQUEST)
      expect(result.current.permissionDenied).toBe(false)
    })

    it('отказ в диалоге сразу возвращает состояние, а не ждёт таймаута', async () => {
      permissionsMock.revoke(...YANDEX_PERMISSION_REQUEST.origins)
      permissionsMock.denyNextRequest()
      const { result } = renderHook(() => useNotesButton())
      await flushEffects()

      await act(async () => {
        result.current.setIsEnabled(true)
      })

      expect(result.current.permissionDenied).toBe(true)
    })
  })

  describe('НСПД', () => {
    it('включает кнопку без доступа к Диску: НСПД работает и без Блокнота', async () => {
      permissionsMock.revoke(...NSPD_HOST_PATTERNS, ...YANDEX_PERMISSION_REQUEST.origins)
      const { result } = renderHook(() => useNspdButton())
      await flushEffects()

      await act(async () => {
        await result.current.setIsEnabled(true)
      })

      // Доступ к НСПД выдан → скрипты зарегистрированы → кнопка на сайте будет.
      expect(scriptingMock.registered.size).toBe(2)
      await expect(getStoredNspdButtonEnabled()).resolves.toBe(true)
      expect(result.current.isEnabled).toBe(true)
    })

    it('не выключает включённую пользователем функцию, если доступа ещё нет', async () => {
      // Пользователь включал НСПД в версии, где доступ был обязательным.
      // Теперь он необязательный и не выдан, но настройка остаётся его выбором.
      await setStoredNspdButtonEnabled(true)

      const { result } = renderHook(() => useNspdButton())
      await flushEffects()

      expect(result.current.isEnabled).toBe(true)
      await expect(getStoredNspdButtonEnabled()).resolves.toBe(true)
      expect(scriptingMock.registered.size).toBe(0)
    })
  })
})
