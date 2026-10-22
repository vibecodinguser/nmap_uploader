import { ERR_NETWORK, ProcessingError } from '@/lib/errors'
import type { YandexUser } from './constants'

export const getHeaders = (token: string): Record<string, string> => ({
  Authorization: `OAuth ${token.trim()}`,
  'Content-Type': 'application/json',
})

export const safeFetch = async (url: string, init?: RequestInit): Promise<Response> => {
  try {
    return await fetch(url, init)
  } catch (error: unknown) {
    let detail = 'сеть недоступна'
    if (error instanceof Error) {
      detail = error.message
    }
    throw new ProcessingError(ERR_NETWORK, `Запрос к Яндекс.Диску не выполнен: ${detail}`)
  }
}

/** Проверяет, что токен действителен для REST API Яндекс.Диска. */
export const verifyDiskAccess = async ({ token }: { token: string }): Promise<void> => {
  const response = await safeFetch('https://cloud-api.yandex.net/v1/disk/?fields=total_space', {
    headers: getHeaders(token),
  })

  if (response.status === 401) {
    throw new ProcessingError(
      ERR_NETWORK,
      'Токен не принят Яндекс.Диском. ' +
        'Выйдите и войдите заново — нужен новый токен с правом cloud_api:disk.write',
    )
  }

  if (!response.ok) {
    const detail = await response.text()
    let suffix = ''
    if (detail) {
      suffix = ` — ${detail}`
    }
    throw new ProcessingError(
      ERR_NETWORK,
      `Яндекс.Диск недоступен: ${response.statusText}${suffix}`,
    )
  }
}

export const assertDiskWriteScope = (scope: string): void => {
  if (scope.includes('cloud_api:disk.write')) {
    return
  }

  throw new ProcessingError(
    ERR_NETWORK,
    `Токен выдан без права записи на Диск (scope: ${scope || 'не указан'}). ` +
      'Выйдите и войдите заново после добавления cloud_api:disk.write в OAuth-приложении',
  )
}

export const throwIfUnauthorized = (status: number, context: string): void => {
  if (status !== 401) {
    return
  }

  throw new ProcessingError(
    ERR_NETWORK,
    `${context}: сессия недействительна. Выйдите и войдите через Яндекс ID заново`,
  )
}

const resolveDefaultAvatarId = (avatarRaw: unknown): string | undefined => {
  if (typeof avatarRaw === 'string' && avatarRaw.trim() !== '') {
    return avatarRaw
  }
  return undefined
}

export const fetchYandexUser = async ({ token }: { token: string }): Promise<YandexUser> => {
  const response = await safeFetch('https://login.yandex.ru/info?format=json', {
    headers: { Authorization: `OAuth ${token}` },
  })

  if (!response.ok) {
    throw new ProcessingError(ERR_NETWORK, 'Не удалось получить данные пользователя')
  }

  const info = (await response.json()) as Record<string, unknown>
  const avatarRaw = info.default_avatar_id

  let id = ''
  if (typeof info.id === 'string' || typeof info.id === 'number') {
    id = String(info.id)
  }

  let login = ''
  if (typeof info.login === 'string') {
    login = info.login
  }

  let displayName: string | undefined
  if (typeof info.display_name === 'string') {
    displayName = info.display_name
  }

  let realName: string | undefined
  if (typeof info.real_name === 'string') {
    realName = info.real_name
  }

  return {
    id,
    login,
    displayName,
    realName,
    defaultAvatarId: resolveDefaultAvatarId(avatarRaw),
  }
}
