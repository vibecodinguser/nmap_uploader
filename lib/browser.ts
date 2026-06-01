const UA_YANDEX_PATTERN = /YaBrowser|Yowser|YaSearchBrowser/i

/** Yandex Browser добавляет «YaBrowser» в userAgent. */
export const isYandexBrowser = (): boolean => {
  if (UA_YANDEX_PATTERN.test(navigator.userAgent)) return true

  const brands = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } })
    .userAgentData?.brands
  return Boolean(brands?.some(({ brand }) => /yandex/i.test(brand)))
}
