import { createNmapOutputTemplate, type NmapIndex } from '@/lib/nmap_index'

export const MIN_LAT = -90
export const MAX_LAT = 90
export const MIN_LON = -180
export const MAX_LON = 180
export const POINT_DESCRIPTION_MAX_LENGTH = 150

const QUOTED_POINT_PATTERN = /"(.*?)"[,\s;]+\s*([-\d.]+)[,\s;]+\s*([-\d.]+)/
const UNQUOTED_POINT_PATTERN = /^(.*?)[,\s;]+\s*([-\d.]+)[,\s;]+\s*([-\d.]+)\s*$/

/** Проверяет, что координаты в допустимых диапазонах. */
export const areCoordinatesValid = ({
  latitude,
  longitude,
}: {
  latitude: number
  longitude: number
}): boolean =>
  MIN_LAT <= latitude && latitude <= MAX_LAT && MIN_LON <= longitude && longitude <= MAX_LON

/** Проверяет формат даты YYYY-MM-DD. */
export const isValidTargetDate = (date: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = new Date(`${date}T00:00:00`)
  return !Number.isNaN(parsed.getTime())
}

/** Создаёт index.json с одной точкой. */
export const createPointIndex = ({
  latitude,
  longitude,
  description,
}: {
  latitude: number
  longitude: number
  description: string
}): NmapIndex => {
  const pointUuid = crypto.randomUUID()
  return {
    paths: {},
    points: {
      [pointUuid]: {
        coords: [longitude, latitude],
        desc: description.slice(0, POINT_DESCRIPTION_MAX_LENGTH),
      },
    },
  }
}

const parsePointLine = (
  lineContent: string,
): { desc: string; latitude: number; longitude: number } | null => {
  const match = QUOTED_POINT_PATTERN.exec(lineContent) ?? UNQUOTED_POINT_PATTERN.exec(lineContent)
  if (!match) return null

  let desc = match[1].trim()
  if (desc.startsWith('"') && desc.endsWith('"')) {
    desc = desc.slice(1, -1)
  }

  const latitude = Number.parseFloat(match[2])
  const longitude = Number.parseFloat(match[3])
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null
  if (!areCoordinatesValid({ latitude, longitude })) return null

  return { desc, latitude, longitude }
}

/** Парсит текстовый файл со списком точек. */
export const processMultipointContent = (content: string): NmapIndex => {
  const data = createNmapOutputTemplate()

  for (const rawLine of content.split(/\r?\n/u)) {
    const lineContent = rawLine.trim()
    if (!lineContent) continue

    const parsed = parsePointLine(lineContent)
    if (!parsed) continue

    const pointUuid = crypto.randomUUID()
    data.points[pointUuid] = {
      coords: [parsed.longitude, parsed.latitude],
      desc: parsed.desc,
    }
  }

  return data
}
