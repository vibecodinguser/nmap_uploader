/**
 * Отрисовка SVG-маркеров, полилиний и предпросмотра фигур в оверлее выбора точек.
 *
 * Квадрат и круг рисуются по двум точкам: первая — начало протяжки, вторая —
 * текущее положение курсора. Это предпросмотр, а не итоговая геометрия:
 * настоящая фигура считается уже в координатах заметки.
 */
const STROKE = 'rgba(0, 120, 255, 0.8)'
const FILL = 'rgba(0, 120, 255, 0.3)'

const createSvgElement = <K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] =>
  document.createElementNS('http://www.w3.org/2000/svg', name)

const appendVertex = (svg: SVGSVGElement, point: { x: number; y: number }, radius = 4): void => {
  const circle = createSvgElement('circle')
  circle.setAttribute('cx', String(point.x))
  circle.setAttribute('cy', String(point.y))
  circle.setAttribute('r', String(radius))
  circle.setAttribute('fill', '#ffffff')
  circle.setAttribute('stroke', STROKE)
  circle.setAttribute('stroke-width', '2')
  svg.appendChild(circle)
}

export const renderPickerSvg = (
  svg: SVGSVGElement,
  accumulatedPixels: { x: number; y: number }[],
  geomType: string,
): void => {
  svg.replaceChildren()
  if (accumulatedPixels.length === 0) return

  const [start, current] = accumulatedPixels

  if (geomType === 'Square' && start && current) {
    const rect = createSvgElement('rect')
    rect.setAttribute('x', String(Math.min(start.x, current.x)))
    rect.setAttribute('y', String(Math.min(start.y, current.y)))
    rect.setAttribute('width', String(Math.abs(current.x - start.x)))
    rect.setAttribute('height', String(Math.abs(current.y - start.y)))
    rect.setAttribute('fill', FILL)
    rect.setAttribute('stroke', STROKE)
    rect.setAttribute('stroke-width', '2')
    svg.appendChild(rect)

    appendVertex(svg, start)
    appendVertex(svg, current)
    return
  }

  if (geomType === 'Circle' && start && current) {
    const radius = Math.hypot(current.x - start.x, current.y - start.y)
    const circle = createSvgElement('circle')
    circle.setAttribute('cx', String(start.x))
    circle.setAttribute('cy', String(start.y))
    circle.setAttribute('r', String(radius))
    circle.setAttribute('fill', FILL)
    circle.setAttribute('stroke', STROKE)
    circle.setAttribute('stroke-width', '2')
    svg.appendChild(circle)

    appendVertex(svg, start)
    appendVertex(svg, current, 3)
    return
  }

  const pointsStr = accumulatedPixels.map((p) => `${p.x},${p.y}`).join(' ')

  if (geomType === 'Polygon' && accumulatedPixels.length > 2) {
    const polygon = createSvgElement('polygon')
    polygon.setAttribute('points', pointsStr)
    polygon.setAttribute('fill', FILL)
    polygon.setAttribute('stroke', STROKE)
    polygon.setAttribute('stroke-width', '2')
    svg.appendChild(polygon)
  } else {
    const polyline = createSvgElement('polyline')
    polyline.setAttribute('points', pointsStr)
    polyline.setAttribute('fill', 'none')
    polyline.setAttribute('stroke', STROKE)
    polyline.setAttribute('stroke-width', '2')
    svg.appendChild(polyline)
  }

  for (const point of accumulatedPixels) {
    appendVertex(svg, point)
  }
}
