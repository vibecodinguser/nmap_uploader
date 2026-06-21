/** Сборка или runtime Firefox (Side Panel). */
export const isFirefox = (): boolean => import.meta.env.BROWSER === 'firefox'

/**
 * Self-contained Yandex Browser check for the service worker and executeScript injection.
 * Must not rely on module closures so it can be serialized into a page context.
 */
export function detectYandexBrowserInPageContext(): boolean {
  const brands = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } })
    .userAgentData?.brands

  let brandMatch = false
  if (brands) {
    for (const { brand } of brands) {
      brandMatch = brandMatch || /yandex/i.test(brand)
    }
  }

  const uaYandexPattern = /YaBrowser|Yowser|YaSearchBrowser/i
  const userAgent = Reflect.get(navigator, 'userAgent') as string
  const uaMatch = uaYandexPattern.test(userAgent)

  return uaMatch || brandMatch
}

/** Yandex Browser добавляет «YaBrowser» в userAgent. */
export function isYandexBrowser(): boolean {
  return detectYandexBrowserInPageContext()
}
