import type { YandexUser } from './client'

export type EnsureAuthResponse = {
  ok: boolean
  user?: YandexUser | null
  error?: string
}

/** Запрос восстановления сессии через background script. */
export const requestEnsureAuth = async ({
  interactive,
}: {
  interactive: boolean
}): Promise<EnsureAuthResponse> => {
  const response = await browser.runtime.sendMessage({
    action: 'ensureAuth',
    interactive,
  })
  return (response ?? { ok: false }) as EnsureAuthResponse
}
