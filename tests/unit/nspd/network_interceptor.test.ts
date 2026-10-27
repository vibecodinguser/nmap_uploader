import { beforeEach, describe, expect, it } from 'vitest'
import { nspdFeatureStore } from '@/lib/nspd/feature_store'
import { inspectAndStorePayload } from '@/lib/nspd/network_interceptor'

describe('NSPD network interceptor', () => {
  beforeEach(() => {
    nspdFeatureStore.clear()
  })

  it('извлекает и сохраняет объекты из FeatureCollection', () => {
    const payload = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [37.6, 55.7] },
          properties: { cad_num: '77:01:0001001:123' },
        },
      ],
    }

    const count = inspectAndStorePayload(payload)
    expect(count).toBe(1)
    expect(nspdFeatureStore.getByCadastralNumber('77:01:0001001:123')).toBeDefined()
  })

  it('извлекает объекты из вложенных списков в ответе API', () => {
    const payload = {
      result: {
        items: [
          {
            geometry: { type: 'Point', coordinates: [37.6, 55.7] },
            properties: { cadastralNumber: '50:20:0010101:50' },
          },
        ],
      },
    }

    const count = inspectAndStorePayload(payload)
    expect(count).toBe(1)
    expect(nspdFeatureStore.getByCadastralNumber('50:20:0010101:50')).toBeDefined()
  })
})
