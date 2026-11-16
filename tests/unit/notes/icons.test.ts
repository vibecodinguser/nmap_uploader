import { describe, expect, it } from 'vitest'
import {
  BUILTIN_ICON_VIEWBOX,
  BUILTIN_ICONS,
  buildBuiltinIconHref,
  findBuiltinIcon,
  isAllowedIconFileName,
  isBuiltinIconId,
  NOTES_ICON_MAX_BYTES,
  notesIconPath,
} from '@/lib/notes/icons'
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

describe('встроенный набор', () => {
  it('достаточно велик для реального выбора', () => {
    expect(BUILTIN_ICONS.length).toBeGreaterThanOrEqual(30)
  })

  it('id уникальны и непустые', () => {
    const ids = BUILTIN_ICONS.map((icon) => icon.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => id.trim().length > 0)).toBe(true)
  })

  it('у каждой иконки есть хотя бы одна фигура с атрибутами', () => {
    for (const icon of BUILTIN_ICONS) {
      expect(icon.shapes.length).toBeGreaterThan(0)
      for (const shape of icon.shapes) {
        expect(shape.tag.length).toBeGreaterThan(0)
        expect(Object.keys(shape.attrs).length).toBeGreaterThan(0)
      }
    }
  })

  it('id годится для записи в манифест: латиница, цифры, дефис', () => {
    for (const icon of BUILTIN_ICONS) {
      expect(icon.id).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it('узнаёт только существующие id', () => {
    expect(isBuiltinIconId('map-pin')).toBe(true)
    expect(isBuiltinIconId('no-such-icon')).toBe(false)
    expect(isBuiltinIconId(42)).toBe(false)
    expect(findBuiltinIcon('no-such-icon')).toBeNull()
    expect(findBuiltinIcon('map-pin')?.id).toBe('map-pin')
  })
})

describe('иконка для карты', () => {
  const icon = findBuiltinIcon('map-pin')

  it('отдаёт data URL с цветом заметки', () => {
    const href = buildBuiltinIconHref({ icon: icon!, color: '#e96b7c' })

    expect(href.startsWith('data:image/svg+xml')).toBe(true)
    const svg = decodeURIComponent(href)
    expect(svg).toContain('stroke="#e96b7c"')
  })

  it('рисует глиф дважды: белая подложка и цвет', () => {
    const svg = decodeURIComponent(buildBuiltinIconHref({ icon: icon!, color: '#1a8cff' }))

    // Тонкие линии на спутниковом снимке без подложки теряются.
    expect(svg).toContain('stroke="#ffffff"')
    expect(svg.match(/<path/g)).toHaveLength(2)
  })

  it('холст совпадает с viewBox глифов', () => {
    const svg = decodeURIComponent(buildBuiltinIconHref({ icon: icon!, color: '#1a8cff' }))

    expect(svg).toContain(`width="${BUILTIN_ICON_VIEWBOX}"`)
    expect(svg).toContain(`viewBox="0 0 ${BUILTIN_ICON_VIEWBOX} ${BUILTIN_ICON_VIEWBOX}"`)
  })

  it('каждая встроенная иконка превращается в картинку', () => {
    for (const item of BUILTIN_ICONS) {
      const href = buildBuiltinIconHref({ icon: item, color: '#000000' })
      expect(href).toContain('data:image/svg+xml')
      expect(decodeURIComponent(href)).toContain('<svg')
    }
  })
})
