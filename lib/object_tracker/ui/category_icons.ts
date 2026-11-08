/**
 * Иконочные классы конкретных категорий из CSS редактора.
 *
 * Список снят с `social-bundle`/`app-bundle`: у редактора есть иконки не только
 * для групп (`group-*`), но и для отдельных категорий — POI, регионы, indoor,
 * платные дороги и прочее. Без этого POI и регионы получали placeholder.
 */
const CATEGORY_ICON_IDS: ReadonlySet<string> = new Set([
  'category-ad-neutral',
  'category-addr-unity',
  'category-aoi',
  'category-bld-complex',
  'category-cond',
  'category-cond-border-checkpoint',
  'category-cond-cam',
  'category-cond-closure',
  'category-cond-hd-trajectory',
  'category-cond-lane',
  'category-cond-pedestrian-traffic-light',
  'category-cond-railway-crossing',
  'category-cond-speed-bump',
  'category-cond-toll',
  'category-cond-toll-connection',
  'category-cond-traffic-light',
  'category-error',
  'category-feedback-limit',
  'category-hd-area',
  'category-hydro',
  'category-hydro-ln-el',
  'category-hydro-ln-jc',
  'category-hydro-point',
  'category-indoor-area',
  'category-indoor-barrier',
  'category-indoor-level',
  'category-indoor-plan',
  'category-indoor-poi-info',
  'category-indoor-poi-infra',
  'category-indoor-turnstile-control-line',
  'category-model3d',
  'category-mrc-region',
  'category-outsource-region',
  'category-piecework-region',
  'category-piecework-task',
  'category-poi-auto',
  'category-poi-culture',
  'category-poi-edu',
  'category-poi-entrance',
  'category-poi-finance',
  'category-poi-food',
  'category-poi-government',
  'category-poi-industry',
  'category-poi-leisure',
  'category-poi-medicine',
  'category-poi-medicine-tr',
  'category-poi-other',
  'category-poi-religion',
  'category-poi-service',
  'category-poi-shopping',
  'category-poi-sport',
  'category-poi-urban',
  'category-region',
  'category-relief',
  'category-rd',
  'category-rd-jc',
  'category-road-marking-point-road-sign-speed-limit',
  'category-road-marking-point-text',
  'category-sport-track',
  'category-toll-road-pass',
  'category-toll-road-system',
  'category-transport-airport',
  'category-transport-airport-terminal',
  'category-transport-bus-route',
  'category-transport-bus-thread',
  'category-transport-bus-thread-connector',
  'category-transport-helicopter',
  'category-transport-metro-el',
  'category-transport-metro-exit',
  'category-transport-metro-station',
  'category-transport-metro-thread-connector',
  'category-transport-operator',
  'category-transport-passageway',
  'category-transport-railway-el',
  'category-transport-railway-platform',
  'category-transport-railway-station',
  'category-transport-stop',
  'category-transport-terminal',
  'category-transport-tram-el',
  'category-transport-tram-route',
  'category-transport-tram-thread',
  'category-transport-tram-thread-connector',
  'category-transport-transition',
  'category-transport-transition-boarding',
  'category-transport-waterway-el',
  'category-transport-waterway-route',
  'category-transport-waterway-stop',
  'category-transport-waterway-thread-connector',
  'category-urban-roadnet-fence-el',
  'category-urban-roadnet-parking-controlled-zone',
  'category-urban-roadnet-parking-lot',
  'category-urban-roadnet-parking-lot-linear',
  'category-urban-roadnet-traffic-light',
  'category-vehicle-restriction',
  'category-vehicle-restriction-area',
  'category-zipcode',
])

/**
 * Категории, которых нет в CSS под своим именем, но есть под чужим.
 * `feed_region` — объект подписки, редактор рисует его иконкой региона.
 */
const CATEGORY_ICON_ALIASES: Readonly<Record<string, string>> = {
  'feed-region': 'category-region',
  region: 'category-region',
}

/** Групповые иконки категорий, которые есть в CSS редактора. */
const CATEGORY_GROUPS = [
  'group-urban-roadnet',
  'group-urban',
  'group-ad',
  'group-addr',
  'group-bld',
  'group-group',
  'group-hydro',
  'group-org',
  'group-rd',
  'group-relief',
  'group-service',
  'group-transport',
  'group-vegetation',
] as const

/**
 * Подбирает иконку категории.
 *
 * Порядок как в редакторе: сначала иконка конкретной категории, затем группа,
 * затем placeholder. Категории вида `ad_jc`, `rd_el`, `poi_food` — подчёркивания
 * заменяем дефисами, как в именах классов.
 */
export const resolveCategoryIconClass = (categoryId?: string): string => {
  const normalized = (categoryId ?? '').toLowerCase().replaceAll('_', '-')
  if (!normalized) {
    return 'nk-geoobject-icon nk-geoobject-icon_id_placeholder'
  }

  const categoryIcon = CATEGORY_ICON_ALIASES[normalized] ?? `category-${normalized}`
  if (CATEGORY_ICON_IDS.has(categoryIcon)) {
    return `nk-geoobject-icon nk-geoobject-icon_id_${categoryIcon}`
  }

  const group = CATEGORY_GROUPS.find((candidate) => {
    const prefix = candidate.replace(/^group-/, '')
    return normalized === prefix || normalized.startsWith(`${prefix}-`)
  })
  return `nk-geoobject-icon nk-geoobject-icon_id_${group ?? 'placeholder'}`
}
