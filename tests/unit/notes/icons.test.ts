import { describe, expect, it } from 'vitest'
import { isAllowedIconFileName, NOTES_ICON_MAX_BYTES, notesIconPath } from '@/lib/notes/icons'
import { parseIconUploadRequest } from '@/lib/notes/icons/request'

const fileName = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png'

describe('имя и путь иконки', () => {
  it('принимает uuid с известным расширением', () => {
    expect(isAllowedIconFileName(fileName)).toBe(true)
    expect(isAllowedIconFileName('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.svg')).toBe(true)
    expect(isAllowedIconFileName('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.webp')).toBe(true)
  })

  it('отклоняет выход из папки, чужие расширения и короткое имя', () => {
    expect(isAllowedIconFileName('../secret.png')).toBe(false)
    expect(isAllowedIconFileName('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.gif')).toBe(false)
    expect(isAllowedIconFileName('icon.png')).toBe(false)
    expect(isAllowedIconFileName('')).toBe(false)
  })

  it('складывает иконки в отдельную папку заметок', () => {
    expect(notesIconPath(fileName)).toMatch(
      /\/notes\/icons\/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa\.png$/,
    )
  })
})

describe('parseIconUploadRequest', () => {
  it('принимает файл в пределах лимита', () => {
    const parsed = parseIconUploadRequest({
      fileName,
      contentType: 'image/png',
      data: btoa('icon'),
    })

    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.value.bytes).toEqual(new TextEncoder().encode('icon'))
      expect(parsed.value.contentType).toBe('image/png')
    }
  })

  it('отклоняет неверное имя, чужой тип и не-строку вместо данных', () => {
    expect(
      parseIconUploadRequest({ fileName: '../evil.png', contentType: 'image/png', data: '' }),
    ).toEqual({ ok: false, error: 'INVALID_PAYLOAD' })
    expect(parseIconUploadRequest({ fileName, contentType: 'image/gif', data: '' })).toEqual({
      ok: false,
      error: 'INVALID_PAYLOAD',
    })
    expect(parseIconUploadRequest({ fileName, contentType: 'image/png', data: 42 })).toEqual({
      ok: false,
      error: 'INVALID_PAYLOAD',
    })
  })

  it('отклоняет файл больше 64 КБ отдельной ошибкой', () => {
    const oversized = btoa('x'.repeat(NOTES_ICON_MAX_BYTES + 1))

    expect(parseIconUploadRequest({ fileName, contentType: 'image/png', data: oversized })).toEqual(
      { ok: false, error: 'ICON_TOO_LARGE' },
    )
  })

  it('ровно 64 КБ ещё проходит', () => {
    const exact = btoa('x'.repeat(NOTES_ICON_MAX_BYTES))

    expect(parseIconUploadRequest({ fileName, contentType: 'image/png', data: exact }).ok).toBe(
      true,
    )
  })
})
