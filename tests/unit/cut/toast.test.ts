// @vitest-environment happy-dom

/**
 * Сообщение о результате разреза.
 *
 * Плашка своя: у редактора её нет, а в тулбаре места для текста не хватает.
 * Проверяем, что сообщение видно, само скрывается и не оставляет за собой ни
 * узлов, ни стилей.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CUT_TOAST_ID,
  CUT_TOAST_STYLE_ID,
  removeCutMessage,
  showCutMessage,
  TOAST_VISIBLE_MS,
} from '@/lib/cut/toast'

const getToast = (): HTMLElement | null => document.getElementById(CUT_TOAST_ID)

beforeEach(() => {
  vi.useFakeTimers()
  document.body.innerHTML = ''
})

afterEach(() => {
  removeCutMessage()
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('сообщение о разрезе', () => {
  it('показывает текст и стиль плашки', () => {
    showCutMessage('Слишком короткая часть')

    const toast = getToast()
    expect(toast).not.toBeNull()
    expect(toast?.hidden).toBe(false)
    expect(toast?.textContent).toBe('Слишком короткая часть')
    expect(document.getElementById(CUT_TOAST_STYLE_ID)).not.toBeNull()
  })

  it('доступно для скринридера', () => {
    showCutMessage('Готово')

    expect(getToast()?.getAttribute('role')).toBe('status')
    expect(getToast()?.getAttribute('aria-live')).toBe('polite')
  })

  it('прячется само через отведённое время', () => {
    showCutMessage('Готово')
    expect(getToast()?.hidden).toBe(false)

    vi.advanceTimersByTime(TOAST_VISIBLE_MS)

    expect(getToast()?.hidden).toBe(true)
  })

  it('новое сообщение заменяет текст и продлевает показ', () => {
    showCutMessage('Первое')
    vi.advanceTimersByTime(TOAST_VISIBLE_MS - 100)

    showCutMessage('Второе')
    expect(getToast()?.textContent).toBe('Второе')

    // Старый таймер не должен спрятать новое сообщение раньше времени.
    vi.advanceTimersByTime(200)
    expect(getToast()?.hidden).toBe(false)

    vi.advanceTimersByTime(TOAST_VISIBLE_MS)
    expect(getToast()?.hidden).toBe(true)
  })

  it('использует один узел на все сообщения', () => {
    showCutMessage('Первое')
    const first = getToast()

    showCutMessage('Второе')

    expect(getToast()).toBe(first)
    expect(document.querySelectorAll(`#${CUT_TOAST_ID}`)).toHaveLength(1)
  })

  it('убирает узел и стиль', () => {
    showCutMessage('Готово')
    expect(getToast()).not.toBeNull()

    removeCutMessage()

    expect(getToast()).toBeNull()
    expect(document.getElementById(CUT_TOAST_STYLE_ID)).toBeNull()
  })

  it('после удаления показ снова работает', () => {
    showCutMessage('Первое')
    removeCutMessage()

    showCutMessage('Второе')

    expect(getToast()?.textContent).toBe('Второе')
    expect(getToast()?.hidden).toBe(false)
  })
})
