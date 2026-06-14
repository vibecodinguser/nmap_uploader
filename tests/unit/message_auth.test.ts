import { describe, expect, it } from 'vitest'
import {
  isExtensionSender,
  isNmapsContentSender,
  isPanelSender,
  isTrustedNmapsOrPanelSender,
  isTrustedPanelSender,
  NMAPS_TAB_URL_PREFIX,
  type RuntimeMessageSender,
} from '@/lib/message_auth'
import { EXTENSION_ID, getURL } from '@/tests/setup/browser_mock'

const panelUrl = getURL('/panel.html')

const buildSender = ({
  id = EXTENSION_ID,
  url,
  tabUrl,
  tabId = 1,
}: {
  id?: string
  url?: string
  tabUrl?: string
  tabId?: number
} = {}): RuntimeMessageSender => ({
  id,
  url,
  tab: tabUrl ? { id: tabId, url: tabUrl } : undefined,
})

describe('message_auth', () => {
  it('isPanelSender: принимает panel.html расширения', () => {
    expect(isPanelSender(buildSender({ url: panelUrl }))).toBe(true)
  })

  it('isNmapsContentSender: принимает content script на n.maps', () => {
    expect(
      isNmapsContentSender(
        buildSender({ tabUrl: `${NMAPS_TAB_URL_PREFIX}#!/objects/1?z=10&ll=1,2` }),
      ),
    ).toBe(true)
  })

  it('isTrustedPanelSender: отклоняет чужой extension id', () => {
    expect(isTrustedPanelSender(buildSender({ id: 'other-extension', url: panelUrl }))).toBe(false)
  })

  it('isTrustedPanelSender: отклоняет nakarte content script', () => {
    expect(isTrustedPanelSender(buildSender({ tabUrl: 'https://nakarte.me/#m=10/55/37' }))).toBe(
      false,
    )
  })

  it('isTrustedNmapsOrPanelSender: принимает panel и n.maps', () => {
    expect(isTrustedNmapsOrPanelSender(buildSender({ url: panelUrl }))).toBe(true)
    expect(
      isTrustedNmapsOrPanelSender(buildSender({ tabUrl: `${NMAPS_TAB_URL_PREFIX}#!/objects/1` })),
    ).toBe(true)
  })

  it('isTrustedNmapsOrPanelSender: отклоняет nakarte', () => {
    expect(
      isTrustedNmapsOrPanelSender(buildSender({ tabUrl: 'https://nakarte.me/#m=10/55/37' })),
    ).toBe(false)
  })

  it('isExtensionSender: принимает sender без id', () => {
    expect(isExtensionSender(buildSender({ id: undefined, url: panelUrl }))).toBe(true)
  })
})
