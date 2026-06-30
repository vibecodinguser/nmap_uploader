export const NMAPS_START_PICK_POINT_EVENT = 'nmap-uploader-start-pick-point' as const
export const NMAPS_POINT_PICKED_EVENT = 'nmap-uploader-point-picked' as const
export const NMAPS_CANCEL_PICK_POINT_EVENT = 'nmap-uploader-cancel-pick-point' as const

export const notifyStartPickPoint = (geomType: string): void => {
  document.dispatchEvent(
    new CustomEvent(NMAPS_START_PICK_POINT_EVENT, { bubbles: true, detail: { geomType } }),
  )
}

export const notifyCancelPickPoint = (): void => {
  document.dispatchEvent(new CustomEvent(NMAPS_CANCEL_PICK_POINT_EVENT, { bubbles: true }))
}

export const notifyPointPicked = (coords: number[][], geomType: string): void => {
  document.dispatchEvent(
    new CustomEvent(NMAPS_POINT_PICKED_EVENT, {
      bubbles: true,
      detail: { coords, geomType },
    }),
  )
}

export const parsePointPickedEvent = (
  event: Event,
): { coords: number[][]; geomType: string } | null => {
  if (!(event instanceof CustomEvent)) return null

  const detail = event.detail as { coords?: unknown; geomType?: string } | undefined
  if (!detail) return null

  const { coords, geomType } = detail
  if (!Array.isArray(coords) || typeof geomType !== 'string') {
    return null
  }

  const validCoords = coords.filter(
    (c): c is [number, number] =>
      Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number',
  )

  if (validCoords.length === 0) {
    return null
  }

  return { coords: validCoords, geomType }
}
