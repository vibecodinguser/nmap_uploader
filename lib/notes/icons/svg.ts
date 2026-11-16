import { BUILTIN_ICON_VIEWBOX, type BuiltinIcon } from './builtin'

/**
 * Иконка как SVG-картинка для карты.
 *
 * Слой живёт в MAIN-мире без React, поэтому получает готовый `data:`-URL.
 * Рисуется в два прохода: сначала белая подложка потолще, потом сам глиф
 * цветом заметки — иначе тонкие линии теряются на спутниковом снимке.
 */
export const buildBuiltinIconHref = ({
  icon,
  color,
}: {
  icon: BuiltinIcon
  color: string
}): string => {
  const size = BUILTIN_ICON_VIEWBOX
  const halo = 2.6
  const stroke = 2

  const shapes = icon.shapes
    .map(({ tag, attrs }) => {
      const attributes = Object.entries(attrs)
        .map(([name, value]) => `${name}="${value}"`)
        .join(' ')
      return `<${tag} ${attributes}/>`
    })
    .join('')

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"`,
    ` fill="none" stroke-linecap="round" stroke-linejoin="round">`,
    `<g stroke="#ffffff" stroke-width="${halo}" opacity="0.9">${shapes}</g>`,
    `<g stroke="${color}" stroke-width="${stroke}">${shapes}</g>`,
    '</svg>',
  ].join('')

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
