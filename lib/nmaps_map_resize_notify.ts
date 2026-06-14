/** Запрос пересчёта размера карты НЯК (isolated → MAIN world). */
export const NMAPS_MAP_RESIZE_EVENT = 'nmap-uploader-nmaps-map-resize' as const

/** Просит MAIN world перерисовать карту после смены layout. */
export const notifyNmapsMapResize = (): void => {
  document.dispatchEvent(new CustomEvent(NMAPS_MAP_RESIZE_EVENT, { bubbles: true }))
}
