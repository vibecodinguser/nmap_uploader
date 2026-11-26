import { describe, it } from 'vitest'
import { verifyYandexAccess } from '@/tests/smoke/yandex_live'

/*
 * Токен берётся из `.env` (его читает `vitest.config.ts`) или из окружения.
 * Без токена сьют помечается пропущенным: раньше он «проходил», ничего не
 * проверив, и это скрывало, что живой API не вызывался ни разу.
 */
const token = process.env.YANDEX_TEST_TOKEN?.trim() ?? ''

describe.skipIf(token === '')('Yandex live smoke', () => {
  it('принимает токен, видит Диск и может создать папки Блокнота', async () => {
    await verifyYandexAccess(token)
  })
})
