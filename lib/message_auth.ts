import { browser } from 'wxt/browser'
import { NMAPS_ORIGIN } from '@/lib/extension_origins'

export const NMAPS_TAB_URL_PREFIX = `${NMAPS_ORIGIN}/` as const

export type RuntimeMessageSender = {
  id?: string
  url?: string
  tab?: {
    id?: number
    url?: string
  }
}

const TRUSTED_EXTENSION_PAGE_PATHS = ['/panel.html', '/polygon-upload.html', '/notes.html'] as const

const getExtensionPageUrl = (path: (typeof TRUSTED_EXTENSION_PAGE_PATHS)[number]): string => {
  const runtime = browser.runtime as typeof browser.runtime & {
    getURL: (path: string) => string
  }
  return runtime.getURL(path)
}

export const isExtensionSender = (sender: RuntimeMessageSender): boolean =>
  sender.id === undefined || sender.id === browser.runtime.id

export const isPanelSender = (sender: RuntimeMessageSender): boolean => {
  const senderUrl = sender.url
  if (!senderUrl) return false
  return TRUSTED_EXTENSION_PAGE_PATHS.some((path) =>
    senderUrl.startsWith(getExtensionPageUrl(path)),
  )
}

export const isNmapsContentSender = (sender: RuntimeMessageSender): boolean =>
  sender.tab?.url?.startsWith(NMAPS_TAB_URL_PREFIX) ?? false

export const isNspdContentSender = (sender: RuntimeMessageSender): boolean => {
  const tabUrl = sender.tab?.url
  if (!tabUrl) return false
  return tabUrl.startsWith('https://nspd.gov.ru/') || tabUrl.startsWith('https://www.nspd.gov.ru/')
}

export const isTrustedPanelSender = (sender: RuntimeMessageSender): boolean =>
  isExtensionSender(sender) && isPanelSender(sender)

export const isTrustedNmapsOrPanelSender = (sender: RuntimeMessageSender): boolean =>
  isExtensionSender(sender) && (isPanelSender(sender) || isNmapsContentSender(sender))

export const isTrustedNspdSender = (sender: RuntimeMessageSender): boolean =>
  isExtensionSender(sender) && isNspdContentSender(sender)

export const logRejectedMessage = (action: string, sender: RuntimeMessageSender): void => {
  console.warn(`[nmap_uploader] отклонено сообщение "${action}"`, {
    senderUrl: sender.url,
    tabUrl: sender.tab?.url,
  })
}
