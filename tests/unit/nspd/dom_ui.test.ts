// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createNspdUploadButton,
  NSPD_ACTION_BUTTON_CLASS,
  NSPD_FLOATING_WIDGET_ID,
  NSPD_TOAST_CONTAINER_ID,
  showNspdToast,
  updateFloatingWidget,
} from '@/lib/nspd/dom_ui'

describe('NSPD dom_ui', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  describe('createNspdUploadButton', () => {
    it('создает кнопку с нужными атрибутами и реагирует на клик', () => {
      const onUpload = vi.fn()
      const button = createNspdUploadButton(onUpload)

      expect(button.className).toBe(NSPD_ACTION_BUTTON_CLASS)
      expect(button.textContent).toContain('В Блокнот картографа')

      button.click()
      expect(onUpload).toHaveBeenCalledTimes(1)
    })
  })

  describe('showNspdToast', () => {
    it('создает контейнер уведомлений и добавляет тост с автоудалением', async () => {
      vi.useFakeTimers()
      showNspdToast('Тестовое уведомление', 'error', 3000)

      const container = document.getElementById(NSPD_TOAST_CONTAINER_ID)
      expect(container).not.toBeNull()
      expect(container?.textContent).toContain('Тестовое уведомление')

      vi.advanceTimersByTime(3300)
      expect(container?.children).toHaveLength(0)
      vi.useRealTimers()
    })
  })

  describe('updateFloatingWidget', () => {
    it('создает плавающий виджет с кадастровым номером и передает его в коллбэк', () => {
      const onUpload = vi.fn()
      updateFloatingWidget('77:01:0001001:999', onUpload)

      const widget = document.getElementById(NSPD_FLOATING_WIDGET_ID)
      expect(widget).not.toBeNull()
      expect(widget?.textContent).toContain('77:01:0001001:999')

      const button = widget?.querySelector('button')
      button?.click()
      expect(onUpload).toHaveBeenCalledWith('77:01:0001001:999', button)
    })

    it('создает виджет по умолчанию при null кадастровом номере', () => {
      const onUpload = vi.fn()
      updateFloatingWidget(null, onUpload)

      const widget = document.getElementById(NSPD_FLOATING_WIDGET_ID)
      expect(widget).not.toBeNull()
      expect(widget?.textContent).toContain('В Блокнот картографа')

      const button = widget?.querySelector('button')
      button?.click()
      expect(onUpload).toHaveBeenCalledWith(null, button)
    })
  })
})
