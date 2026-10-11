// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import { createPolygonUploadButton, POLYGON_UPLOAD_BUTTON_ID } from '@/lib/polygon_upload_button'

describe('polygon upload toolbar button', () => {
  it('создаёт кнопку загрузки в стиле toolbar', () => {
    const button = createPolygonUploadButton('Загрузить полигоны')

    expect(button.id).toBe(POLYGON_UPLOAD_BUTTON_ID)
    expect(button.type).toBe('button')
    expect(button.getAttribute('aria-label')).toBe('Загрузить полигоны')
    expect(button.classList.contains('nk-map-region-view__button')).toBe(true)
    expect(button.querySelector('.nmap-uploader-goto-icon svg')).not.toBeNull()
  })
})
