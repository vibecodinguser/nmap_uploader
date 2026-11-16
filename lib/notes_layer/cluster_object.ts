import type { NoteCluster } from './clustering'
import type { RenderedNote } from './objects'

/**
 * Значок кластера.
 *
 * Круг с числом объектов внутри. Цвет нейтральный: кластер смешивает заметки
 * разных цветов, и брать цвет одной из них значило бы врать про остальные.
 */

/** Размеры значка по числу объектов: крупный кластер заметнее. */
const sizeFor = (count: number): number => {
  if (count >= 100) return 44
  if (count >= 20) return 38
  if (count >= 5) return 32
  return 26
}

/** Склонение не нужно: в значке только число, поэтому форма одна. */
export const clusterLabel = (count: number): string => String(count)

export const buildClusterIconHref = ({ count }: { count: number }): string => {
  const size = sizeFor(count)
  const radius = size / 2
  const fontSize = size <= 26 ? 12 : size <= 38 ? 13 : 14
  const text = clusterLabel(count)

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `<circle cx="${radius}" cy="${radius}" r="${radius - 1}" fill="#2f3b45" fill-opacity="0.92"`,
    ` stroke="#ffffff" stroke-width="2"/>`,
    `<text x="${radius}" y="${radius}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif"`,
    ` font-size="${fontSize}" font-weight="600" text-anchor="middle" dominant-baseline="central">`,
    `${text}</text>`,
    '</svg>',
  ].join('')

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/**
 * Описание объекта кластера для карты.
 *
 * `kind: 'point'` намеренно: адаптер создаёт по этому описанию обычный
 * `Placemark` с картинкой, и отдельная ветка отрисовки ему не нужна.
 */
export const renderCluster = (cluster: NoteCluster): RenderedNote => {
  const count = cluster.noteIds.length
  const size = sizeFor(count)
  const hint = count === 1 ? 'Объект в кластере' : `Объектов в кластере: ${clusterLabel(count)}`

  return {
    id: cluster.id,
    kind: 'point',
    coordinates: cluster.coordinates,
    options: {
      cursor: 'pointer',
      hintContent: hint,
      iconLayout: 'default#image',
      iconImageHref: buildClusterIconHref({ count }),
      iconImageSize: [size, size],
      iconImageOffset: [-size / 2, -size / 2],
    },
    // `clusterNoteIds` — единственный признак кластера в свойствах объекта:
    // по нему обработчик клика понимает, что надо приблизить карту, а не
    // выбирать заметку.
    properties: {
      clusterNoteIds: cluster.noteIds.join(','),
      hintContent: hint,
    },
  }
}
