export const YANDEX_CLIENT_ID = 'ef45c7e176e844c087bc2487985ad275'
export const YANDEX_DISK_FOLDER = 'Приложения/Блокнот картографа Народной карты'
export const YANDEX_DISK_SCOPES = [
  'login:avatar',
  'cloud_api:disk.read',
  'cloud_api:disk.write',
].join(' ')

export const API_BASE_URL = 'https://cloud-api.yandex.net/v1/disk/resources'

export const STORAGE_TOKEN_KEY = 'yandex_token'
export const STORAGE_USER_KEY = 'yandex_user'
export const STORAGE_EXPLICIT_LOGOUT_KEY = 'yandex_explicit_logout'

export type YandexUser = {
  id: string
  login: string
  displayName?: string
  realName?: string
  defaultAvatarId?: string
}

export type YandexAvatarSize =
  | 'islands-small'
  | 'islands-34'
  | 'islands-50'
  | 'islands-retina-50'
  | 'islands-75'

export type AuthPayload = {
  user: YandexUser | null
  avatarDataUrl: string | null
}
