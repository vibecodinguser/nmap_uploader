import { describe, expect, it } from 'vitest'
import { NMAP_UPLOADER_MSG_SOURCE } from '@/lib/go_to_map_sync'
import { parseSetLocationMessage } from '@/lib/nakarte_location_apply'

describe('parseSetLocationMessage', () => {
  it('разбирает set_location от родительской панели', () => {
    const location = parseSetLocationMessage({
      source: NMAP_UPLOADER_MSG_SOURCE,
      type: 'set_location',
      location: { longitude: 37.6, latitude: 55.7, zoom: 14.8 },
    })

    expect(location).toEqual({
      longitude: 37.6,
      latitude: 55.7,
      zoom: 14.8,
    })
  })

  it('возвращает null для чужих сообщений', () => {
    expect(
      parseSetLocationMessage({ source: 'other', type: 'set_location', location: null }),
    ).toBeNull()
  })
})
