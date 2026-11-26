import { verifyDiskAccess } from '@/lib/yandex/auth_client'
import { ensureStorageFolders } from '@/lib/yandex/disk_api'

/**
 * Живая проверка доступа к Яндекс.Диску.
 *
 * Запросы идут в настоящий API: MSW в проекте `smoke` не поднимается. Поэтому
 * тест ловит то, чего не видят unit-тесты с моками: истёкший или отозванный
 * токен, потерянные права на запись, изменение формата ответа Диска.
 *
 * `ensureStorageFolders` — единственная запись: она создаёт папки приложений,
 * если их ещё нет, то есть ровно то, что расширение делает при первой загрузке.
 * Поэтому проверяется и право `cloud_api:disk.write`, а не только чтение.
 */
export async function verifyYandexAccess(token: string): Promise<void> {
  await verifyDiskAccess({ token })
  await ensureStorageFolders({ token })
}
