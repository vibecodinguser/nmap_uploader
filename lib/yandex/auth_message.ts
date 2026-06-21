import { browser } from 'wxt/browser'
import type { YandexUser } from './client'

export type EnsureAuthResponse = {
  ok: boolean
  user?: YandexUser | null
  avatarDataUrl?: string | null
  error?: string
}

/** Запрос восстановления сессии через background script. */
export const requestEnsureAuth = async ({
  interactive,
}: {
  interactive: boolean
}): Promise<EnsureAuthResponse> => {
  const response = (await browser.runtime.sendMessage({
    action: 'ensureAuth',
    interactive,
  })) as EnsureAuthResponse | undefined
  return response ?? { ok: false }
}
