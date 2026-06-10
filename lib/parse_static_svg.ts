const svgDocumentCache = new Map<string, SVGSVGElement>()

/** Парсит статическую SVG-разметку через DOMParser без innerHTML на живом DOM. */
export const parseStaticSvg = (svgMarkup: string): SVGSVGElement => {
  const cached = svgDocumentCache.get(svgMarkup)
  if (cached) return cached.cloneNode(true) as SVGSVGElement

  const doc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml')
  const svg = doc.documentElement
  if (!(svg instanceof SVGSVGElement)) {
    throw new Error('parseStaticSvg: некорректная SVG-разметка')
  }

  svgDocumentCache.set(svgMarkup, svg)
  return svg.cloneNode(true) as SVGSVGElement
}
