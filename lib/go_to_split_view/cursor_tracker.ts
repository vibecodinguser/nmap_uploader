/**
 * Логика синхронизации позиций курсора в сплит-режиме Go To.
 */
import { latLngToPanelPixel, mouseToLatLng } from '@/lib/go_to_geo_projection'
import type { MapLocation } from '@/lib/go_to_link'
import { clampMarkerPosition, SPLIT_MAX_RECOMMENDED_ZOOM } from '@/lib/go_to_split_view/core'
import {
  getLeftPanelSize,
  getNmapsMapViewportBounds,
  getRightPanelSize,
  type SplitDomElements,
  setMarkerElementPosition,
} from '@/lib/go_to_split_view/dom'
import { readNmapsLocation } from './split_bridge'

export class SplitCursorTracker {
  constructor(private readonly dom: SplitDomElements) {}

  public hideCursorMarkers(): void {
    this.hideLeftCursorMarker()
    this.hideRightCursorMarker()
  }

  public hideLeftCursorMarker(): void {
    setMarkerElementPosition(this.dom.leftCursorMarker, null)
  }

  public hideRightCursorMarker(): void {
    setMarkerElementPosition(this.dom.rightCursorMarker, null)
  }

  public updateRightCursorFromGeo(
    location: MapLocation | null,
    nakarteLocation: MapLocation | null,
  ): void {
    const panel = getRightPanelSize()
    if (!location || !nakarteLocation) {
      this.hideRightCursorMarker()
      return
    }

    const pixel = latLngToPanelPixel(location, nakarteLocation, panel)
    if (!pixel) {
      this.hideRightCursorMarker()
      return
    }

    const clamped = clampMarkerPosition(pixel, panel)
    setMarkerElementPosition(this.dom.rightCursorMarker, clamped)
  }

  public updateLeftCursorFromGeo(
    location: MapLocation | null,
    nmapsLocation: MapLocation | null,
  ): void {
    const panel = getLeftPanelSize()
    if (!location || !nmapsLocation) {
      this.hideLeftCursorMarker()
      return
    }

    const hasDifferentZooms =
      location.zoom !== undefined && Math.round(location.zoom) !== Math.round(nmapsLocation.zoom)
    if (
      hasDifferentZooms &&
      location.zoom <= SPLIT_MAX_RECOMMENDED_ZOOM &&
      nmapsLocation.zoom <= SPLIT_MAX_RECOMMENDED_ZOOM
    ) {
      this.hideLeftCursorMarker()
      return
    }

    const mapBounds = getNmapsMapViewportBounds()
    const pixel = latLngToPanelPixel(location, nmapsLocation, panel, 'spherical', {
      cx: mapBounds.cx,
      cy: mapBounds.cy,
    })
    if (!pixel) {
      this.hideLeftCursorMarker()
      return
    }

    const clamped = clampMarkerPosition(pixel, panel)
    setMarkerElementPosition(this.dom.leftCursorMarker, clamped)
  }

  public handleNmapsMouseMove(
    event: MouseEvent,
    nmapsLocation: MapLocation | null,
    nakarteLocation: MapLocation | null,
  ): void {
    const view = nmapsLocation ?? readNmapsLocation()
    if (!view || !nakarteLocation) {
      this.hideRightCursorMarker()
      return
    }

    // Если зумы карт различаются в момент анимации (в диапазоне до 18), скрываем маркер во избежание ложного смещения
    const hasDifferentZooms = Math.round(view.zoom) !== Math.round(nakarteLocation.zoom)
    if (
      hasDifferentZooms &&
      view.zoom <= SPLIT_MAX_RECOMMENDED_ZOOM &&
      nakarteLocation.zoom <= SPLIT_MAX_RECOMMENDED_ZOOM
    ) {
      this.hideRightCursorMarker()
      return
    }

    const panel = getLeftPanelSize()
    const { clientX, clientY } = event
    if (clientX < 0 || clientX > panel.width || clientY < 0 || clientY > panel.height) {
      this.hideRightCursorMarker()
      return
    }

    const mapBounds = getNmapsMapViewportBounds()
    const cursor = mouseToLatLng(clientX, clientY, view, panel, 'spherical', {
      cx: mapBounds.cx,
      cy: mapBounds.cy,
    })
    this.updateRightCursorFromGeo(cursor, nakarteLocation)
  }

  public handleNmapsMouseLeave(): void {
    this.hideRightCursorMarker()
  }
}
