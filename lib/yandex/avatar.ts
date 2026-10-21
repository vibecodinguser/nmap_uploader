import type { YandexAvatarSize, YandexUser } from './constants'

export const getYandexAvatarUrl = ({
  avatarId,
  size = 'islands-small',
}: {
  avatarId?: string
  size?: YandexAvatarSize
}): string | null => {
  const id = avatarId?.trim()
  if (!id) {
    return null
  }
  if (id.startsWith('https://avatars.yandex.net/')) {
    return id.replace(/\/islands-[\w-]+$/, `/${size}`)
  }
  return `https://avatars.yandex.net/get-yapic/${id}/${size}`
}

const bytesToDataUrl = (bytes: Uint8Array, mime: string): string => {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize)
    binary += String.fromCodePoint(...chunk)
  }
  return `data:${mime};base64,${btoa(binary)}`
}

/** Загружает портрет в background (обход CSP n.maps для shadow DOM). */
export const fetchYandexAvatarDataUrl = async ({
  avatarId,
  size = 'islands-small',
}: {
  avatarId: string
  size?: YandexAvatarSize
}): Promise<string | null> => {
  const url = getYandexAvatarUrl({ avatarId, size })
  if (!url) {
    return null
  }

  try {
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }
    const buffer = await response.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    if (bytes.length === 0) {
      return null
    }
    const contentType = response.headers.get('content-type')
    const mimeTypeStr = contentType?.split(';')[0]
    const mime = mimeTypeStr?.trim() || 'image/jpeg'
    return bytesToDataUrl(bytes, mime)
  } catch {
    return null
  }
}

export const loadUserAvatarDataUrl = async (user: YandexUser): Promise<string | null> => {
  const avatarId = user.defaultAvatarId?.trim()
  if (!avatarId) {
    return null
  }
  return fetchYandexAvatarDataUrl({ avatarId, size: 'islands-retina-50' })
}
