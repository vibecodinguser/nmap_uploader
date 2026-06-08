export type GoToSource = {
  linkTemplate: string
  maxZoom?: number
  convert?: boolean
  countZoom?: readonly [number, number]
  iconUrl?: string
  iconDomain?: string
  displayName?: string
}

export const GO_TO_SOURCES: Record<string, GoToSource> = {
  OpenStreetMap: {
    linkTemplate: 'https://www.openstreetmap.org/#map={zoom}/{lat}/{lon}',
    displayName: 'OpenStreetMap',
  },
  Nakarte: {
    linkTemplate: 'http://nakarte.me/#m={zoom}/{lat}/{lon}&l=S/K',
    displayName: 'Nakarte',
  },
  Wikimapia: {
    linkTemplate: 'http://wikimapia.org/#lang=ru&lat={lat}&lon={lon}&z={zoom}&m=ys',
    displayName: 'Wikimapia',
  },
  Retromap: {
    linkTemplate: 'http://www.retromap.ru/m.html#l=0120090&z={zoom}&y={lat}&x={lon}',
    displayName: 'Retromap',
  },
  Rosreestr: {
    linkTemplate:
      'https://nspd.gov.ru/map?thematic=PKK&zoom={zoom}&coordinate_x={lon}&coordinate_y={lat}&theme_id=1&baseLayerId=235&is_copy_url=true&active_layers=875831',
    maxZoom: 20,
    convert: true,
    displayName: 'Портал НСПД',
  },
  '2GIS': {
    linkTemplate: 'https://2gis.ru/center?m={lon}%2C{lat}%2F{zoom}',
    displayName: '2GIS',
  },
  Google: {
    linkTemplate: 'https://www.google.ru/maps/@{lat},{lon},{zoom}z/data=!3m1!1e3?hl=ru',
    iconUrl: '//favicon.yandex.net/favicon/maps.google.ru?size=32&stub=1',
    displayName: 'Google Maps',
  },
  Bing: {
    linkTemplate: 'https://www.bing.com/maps?cp={lat}~{lon}&style=h&lvl={zoom}',
    displayName: 'Bing Maps',
  },
  Mapillary: {
    linkTemplate: 'https://www.mapillary.com/app/?focus=map&lat={lat}&lng={lon}&z={zoom}',
    displayName: 'Mapillary',
  },
  Copernicus: {
    linkTemplate: 'https://browser.dataspace.copernicus.eu/?lat={lat}&lng={lon}&zoom={zoom}',
    displayName: 'Copernicus',
  },
  Here: {
    linkTemplate: 'https://wego.here.com/?map={lat},{lon},{zoom},satellite&x=ep',
    displayName: 'Here Maps ',
  },
}

export const GO_TO_SOURCE_NAMES = Object.keys(GO_TO_SOURCES)

export const getGoToSourceDisplayName = (name: string): string => {
  const source = GO_TO_SOURCES[name]
  return source?.displayName ?? name
}

export const getGoToSourceIconUrl = (name: string): string => {
  const source = GO_TO_SOURCES[name]
  if (!source) return ''

  if (source.iconUrl)
    return source.iconUrl.startsWith('//') ? `https:${source.iconUrl}` : source.iconUrl

  const domain = source.iconDomain ?? source.linkTemplate.match(/:\/\/([^/]+)/)?.[1] ?? ''

  return `https://favicon.yandex.net/favicon/${domain}?stub=1`
}
