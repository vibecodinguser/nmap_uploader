import { ERR_NETWORK, ProcessingError } from '@/lib/errors'

const ALLOWED_DISK_HOST_PATTERN = /^(?:[\w-]+\.)*disk\.yandex\.(?:ru|com|net)$/u

/** Проверяет, что URL pre-signed загрузки/скачивания ведёт на домен Яндекс.Диска. */
export const isAllowedDiskHref = (href: string): boolean => {
  try {
    const url = new URL(href)
    if (url.protocol !== 'https:') return false
    return ALLOWED_DISK_HOST_PATTERN.test(url.hostname)
  } catch {
    return false
  }
}

/** Отклоняет href вне allowlist Яндекс.Диска (защита от SSRF через подмену ответа API). */
export const assertAllowedDiskHref = (href: string): void => {
  if (isAllowedDiskHref(href)) return

  throw new ProcessingError(ERR_NETWORK, 'Недопустимый URL загрузки или скачивания с Яндекс.Диска')
}
