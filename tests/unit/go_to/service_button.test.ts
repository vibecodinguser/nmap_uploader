// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import { createGoToServiceButton } from '@/lib/go_to_service_button'
import { createNotesButton } from '@/lib/notes_button'
import { createNspdButton } from '@/lib/nspd/nspd_button'
import { createPolygonUploadButton } from '@/lib/polygon_upload_button'

/**
 * Фон кнопки задают нативные стили редактора по классам и типу элемента.
 * Кнопка геосервисов должна не отличаться от соседних кнопок тулбара.
 */
describe('createGoToServiceButton', () => {
  it('создаётся как <button>, а не как ссылка', () => {
    const button = createGoToServiceButton()

    expect(button.tagName).toBe('BUTTON')
    expect(button.getAttribute('type')).toBe('button')
  })

  it('несёт те же нативные классы, что и соседние кнопки тулбара', () => {
    const ownClasses = new Set(createGoToServiceButton().classList)
    const neighbours = [createNotesButton(), createPolygonUploadButton(), createNspdButton()]

    for (const neighbour of neighbours) {
      for (const className of neighbour.classList) {
        // Маркер конкретной кнопки у каждого свой — сравниваем остальные.
        if (className.startsWith('nmap-uploader-') && className !== 'nmap-uploader-goto-btn') {
          continue
        }
        expect(ownClasses.has(className)).toBe(true)
      }
    }
  })
})
