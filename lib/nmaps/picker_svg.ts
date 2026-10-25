/**
 * Отрисовка SVG-маркеров и полилиний в интерактивном оверлее выбора точек.
 */
export const renderPickerSvg = (
  svg: SVGSVGElement,
  accumulatedPixels: { x: number; y: number }[],
  geomType: string,
): void => {
  svg.replaceChildren()
  if (accumulatedPixels.length === 0) return

  const pointsStr = accumulatedPixels.map((p) => `${p.x},${p.y}`).join(' ')

  if (geomType === 'Polygon' && accumulatedPixels.length > 2) {
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
    polygon.setAttribute('points', pointsStr)
    polygon.setAttribute('fill', 'rgba(0, 120, 255, 0.3)')
    polygon.setAttribute('stroke', 'rgba(0, 120, 255, 0.8)')
    polygon.setAttribute('stroke-width', '2')
    svg.appendChild(polygon)
  } else {
    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
    polyline.setAttribute('points', pointsStr)
    polyline.setAttribute('fill', 'none')
    polyline.setAttribute('stroke', 'rgba(0, 120, 255, 0.8)')
    polyline.setAttribute('stroke-width', '2')
    svg.appendChild(polyline)
  }

  for (const p of accumulatedPixels) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    circle.setAttribute('cx', String(p.x))
    circle.setAttribute('cy', String(p.y))
    circle.setAttribute('r', '4')
    circle.setAttribute('fill', '#ffffff')
    circle.setAttribute('stroke', 'rgba(0, 120, 255, 0.8)')
    circle.setAttribute('stroke-width', '2')
    svg.appendChild(circle)
  }
}
