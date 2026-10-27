import { beforeEach, describe, expect, it } from 'vitest'
import { nspdFeatureStore } from '@/lib/nspd/feature_store'

describe('NSPD feature store', () => {
  beforeEach(() => {
    nspdFeatureStore.clear()
  })

  it('сохраняет объект и находит по кадастровому номеру', () => {
    nspdFeatureStore.add({
      cadastralNumber: '77:01:0001001:10',
      geometry: { type: 'Point', coordinates: [37.6, 55.7] },
      address: 'Москва',
    })

    const found = nspdFeatureStore.getByCadastralNumber('77:01:0001001:10')
    expect(found).toBeDefined()
    expect(found?.address).toBe('Москва')
  })

  it('возвращает последние объекты для выгрузки если кадастровый номер не указан', () => {
    nspdFeatureStore.add({
      geometry: { type: 'Point', coordinates: [37.6, 55.7] },
      properties: { label: 'Участок' },
    })

    const resolved = nspdFeatureStore.resolveObjectsForUpload(null)
    expect(resolved).toHaveLength(1)
  })
})
