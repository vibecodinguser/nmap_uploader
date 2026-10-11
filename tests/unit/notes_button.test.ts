// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { browser } from 'wxt/browser'
import { useNotesButton } from '@/hooks/useNotesButton'
import {
  createNotesButton,
  getStoredNotesButtonEnabled,
  NOTES_BUTTON_ENABLED_STORAGE_KEY,
  NOTES_BUTTON_ID,
  setStoredNotesButtonEnabled,
} from '@/lib/notes_button'
import { resetBrowserMocks } from '../setup/browser_mock'

describe('notes_button', () => {
  beforeEach(async () => {
    await resetBrowserMocks()
  })

  it('создаёт кнопку заметок с правильными атрибутами', () => {
    const button = createNotesButton('Заметки')
    expect(button.id).toBe(NOTES_BUTTON_ID)
    expect(button.getAttribute('aria-label')).toBe('Заметки')
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })

  it('по умолчанию возвращает false при отсутствии значения в хранилище', async () => {
    const enabled = await getStoredNotesButtonEnabled()
    expect(enabled).toBe(false)
  })

  it('сохраняет и читает значение настройки кнопки заметок', async () => {
    await setStoredNotesButtonEnabled(false)
    expect(await getStoredNotesButtonEnabled()).toBe(false)

    await setStoredNotesButtonEnabled(true)
    expect(await getStoredNotesButtonEnabled()).toBe(true)
  })

  it('корректно читает значение, установленное напрямую в storage', async () => {
    await browser.storage.local.set({ [NOTES_BUTTON_ENABLED_STORAGE_KEY]: false })
    expect(await getStoredNotesButtonEnabled()).toBe(false)
  })

  it('хук useNotesButton инициализируется и сохраняет новое состояние', async () => {
    const { result } = renderHook(() => useNotesButton())

    await act(async () => {
      // ждём загрузки
    })

    expect(result.current.isEnabled).toBe(false)
    expect(result.current.isLoaded).toBe(true)

    await act(async () => {
      result.current.setIsEnabled(true)
    })

    expect(result.current.isEnabled).toBe(true)
    expect(await getStoredNotesButtonEnabled()).toBe(true)
  })
})
