// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildObjectUrl } from '@/lib/object_tracker/ui/format'
import { openNmapsRoute } from '@/lib/object_tracker/ui/navigation'

const OBJECT_URL = 'https://n.maps.yandex.ru/#!/objects/4465652155'

describe('object_tracker: ссылка на карточку объекта', () => {
  it('переносит текущий вид карты в маршрут объекта', () => {
    const href =
      'https://n.maps.yandex.ru/#!/users/stylesvoboda/feeds/edits?mode=events&z=18&ll=38.9%2C45.0&l=nk%23sat'

    expect(buildObjectUrl('4465652155', href)).toBe(
      `${OBJECT_URL}?mode=events&z=18&ll=38.9%2C45.0&l=nk%23sat`,
    )
  })

  it('строит маршрут объекта без параметров, если их нет', () => {
    expect(buildObjectUrl('4465652155', 'https://n.maps.yandex.ru/#!/')).toBe(OBJECT_URL)
  })

  it('возвращает маршрут объекта, если адрес редактора не распознан', () => {
    expect(buildObjectUrl('4465652155', '')).toBe(OBJECT_URL)
    expect(buildObjectUrl('4465652155', 'https://example.com/')).toBe(OBJECT_URL)
  })

  it('возвращает маршрут объекта, если в адресе нет хеш-маршрута', () => {
    expect(buildObjectUrl('4465652155', 'https://n.maps.yandex.ru/#objects')).toBe(OBJECT_URL)
  })

  it('не падает на нестроковом адресе', () => {
    expect(buildObjectUrl('4465652155', null as unknown as string)).toBe(OBJECT_URL)
  })
})

describe('object_tracker: переход по маршруту редактора', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('меняет адрес и перезагружает страницу', () => {
    // Роутер редактора не реагирует на смену hash извне: без перезагрузки
    // адрес меняется, а вид остаётся прежним.
    const assign = vi.fn()
    const reload = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      href: 'https://n.maps.yandex.ru/#!/',
      assign,
      reload,
    } as unknown as Location)

    openNmapsRoute(`${OBJECT_URL}?z=18`)

    expect(assign).toHaveBeenCalledWith(`${OBJECT_URL}?z=18`)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('ничего не делает, если адрес уже открыт', () => {
    const assign = vi.fn()
    const reload = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      href: OBJECT_URL,
      assign,
      reload,
    } as unknown as Location)

    openNmapsRoute(OBJECT_URL)

    expect(assign).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })
})
