// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  hideTrackerToast,
  showTrackerToast,
  TRACKER_TOAST_ID,
  TRACKER_TOAST_VISIBLE_CLASS,
} from '@/lib/object_tracker/ui/toast'

describe('object_tracker: сообщение об ошибке', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = ''
    document.head.innerHTML = ''
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('показывает сообщение и убирает его через 3 секунды', () => {
    showTrackerToast('Объект уже добавлен')

    const toast = document.getElementById(TRACKER_TOAST_ID)
    expect(toast?.textContent).toBe('Объект уже добавлен')
    expect(toast?.classList.contains(TRACKER_TOAST_VISIBLE_CLASS)).toBe(true)
    expect(toast?.getAttribute('role')).toBe('status')

    vi.advanceTimersByTime(3000)
    expect(document.getElementById(TRACKER_TOAST_ID)).toBeNull()
  })

  it('переиспользует один элемент при повторных сообщениях', () => {
    showTrackerToast('Первое')
    showTrackerToast('Второе')

    const toasts = document.querySelectorAll(`#${TRACKER_TOAST_ID}`)
    expect(toasts).toHaveLength(1)
    expect(toasts[0]?.textContent).toBe('Второе')
  })

  it('продлевает показ при новом сообщении', () => {
    showTrackerToast('Первое')
    vi.advanceTimersByTime(2000)
    showTrackerToast('Второе')

    vi.advanceTimersByTime(2000)
    expect(document.getElementById(TRACKER_TOAST_ID)?.textContent).toBe('Второе')

    vi.advanceTimersByTime(1000)
    expect(document.getElementById(TRACKER_TOAST_ID)).toBeNull()
  })

  it('убирает сообщение досрочно', () => {
    showTrackerToast('Ошибка')
    hideTrackerToast()

    expect(document.getElementById(TRACKER_TOAST_ID)).toBeNull()
    vi.advanceTimersByTime(3000)
    expect(document.getElementById(TRACKER_TOAST_ID)).toBeNull()
  })

  it('игнорирует пустой текст', () => {
    showTrackerToast('')

    expect(document.getElementById(TRACKER_TOAST_ID)).toBeNull()
  })
})
