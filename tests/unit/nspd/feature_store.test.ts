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

  it('сохраняет объект и находит по реестровому номеру', () => {
    nspdFeatureStore.add({
      registryNumber: '50:00-6.1234',
      geometry: { type: 'Point', coordinates: [37.6, 55.7] },
      address: 'Московская область',
    })

    const found = nspdFeatureStore.getByRegistryNumber('50:00-6.1234')
    expect(found).toBeDefined()
    expect(found?.address).toBe('Московская область')

    const resolved = nspdFeatureStore.resolveObjectsForUpload('50:00-6.1234')
    expect(resolved).toHaveLength(1)
  })

  it('возвращает только один выбранный объект, а не все объекты на экране', () => {
    // Симулируем несколько полигонов, отображаемых на экране карты
    nspdFeatureStore.add({
      cadastralNumber: '77:01:0001001:1',
      geometry: { type: 'Polygon', coordinates: [] },
    })
    nspdFeatureStore.add({
      cadastralNumber: '77:01:0001001:2',
      geometry: { type: 'Polygon', coordinates: [] },
    })
    nspdFeatureStore.add({
      cadastralNumber: '77:01:0001001:3',
      geometry: { type: 'Polygon', coordinates: [] },
    })

    // По запросу конкретного номера возвращается только один выбранный полигон
    const resolvedById = nspdFeatureStore.resolveObjectsForUpload('77:01:0001001:2')
    expect(resolvedById).toHaveLength(1)
    expect(resolvedById[0].cadastralNumber).toBe('77:01:0001001:2')

    // Даже без переданного номера возвращается только один последний объект
    const resolvedNull = nspdFeatureStore.resolveObjectsForUpload(null)
    expect(resolvedNull).toHaveLength(1)
    expect(resolvedNull[0].cadastralNumber).toBe('77:01:0001001:3')
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
