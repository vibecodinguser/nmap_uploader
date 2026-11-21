import { afterEach, describe, expect, it, vi } from 'vitest'
import { diskResourceExists, moveDiskResource } from '@/lib/yandex/disk_resources'

const jsonResponse = (status: number, body: unknown = {}): Response =>
  new Response(JSON.stringify(body), { status })

describe('yandex: ресурсы Диска', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('проверяет существование ресурса по логическому пути', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { type: 'dir' }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await diskResourceExists({ logicalPath: 'Приложения/Nmap Uploader', token: 't' })).toBe(
      true,
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(new URL(url).searchParams.get('path')).toBe('/Приложения/Nmap Uploader')
    expect((init.headers as Record<string, string>).Authorization).toBe('OAuth t')
  })

  it('считает отсутствующий ресурс несуществующим', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(404, { error: 'DiskNotFoundError' })),
    )

    expect(await diskResourceExists({ logicalPath: 'нет/такой', token: 't' })).toBe(false)
  })

  it('переносит папку на новое место', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(201))
    vi.stubGlobal('fetch', fetchMock)

    await moveDiskResource({
      from: 'Приложения/Блокнот/notes',
      to: 'Приложения/Nmap Uploader/notes',
      token: 't',
    })

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const params = new URL(url).searchParams
    expect(init.method).toBe('POST')
    expect(url).toContain('/move?')
    expect(params.get('from')).toBe('/Приложения/Блокнот/notes')
    expect(params.get('path')).toBe('/Приложения/Nmap Uploader/notes')
    expect(params.get('overwrite')).toBe('false')
  })

  it('сообщает об ошибке переноса', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(409, { error: 'DiskResourceAlreadyExistsError' })),
    )

    await expect(moveDiskResource({ from: 'a', to: 'b', token: 't' })).rejects.toThrow(
      'Не удалось перенести',
    )
  })

  it('отдельно сообщает об истёкшей сессии', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(401)),
    )

    await expect(moveDiskResource({ from: 'a', to: 'b', token: 't' })).rejects.toThrow(
      'сессия недействительна',
    )
  })
})
