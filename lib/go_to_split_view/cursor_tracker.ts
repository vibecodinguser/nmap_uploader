/**
 * Логика синхронизации позиций курсора в сплит-режиме Go To.
 */
import { latLngToPanelPixel, mouseToLatLng } from '@/lib/go_to_geo_projection'
import type { MapLocation } from '@/lib/go_to_link'
import { clampMarkerPosition } from '@/lib/go_to_split_view/core'
import {
  getLeftPanelSize,
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

    const pixel = latLngToPanelPixel(location, nmapsLocation, panel)
    if (!pixel) {
      this.hideLeftCursorMarker()
      return
    }

    const clamped = clampMarkerPosition(pixel, panel)
    setMarkerElementPosition(this.dom.leftCursorMarker, clamped)
  }

  public handleNmapsMouseMove(event: MouseEvent, nakarteLocation: MapLocation | null): void {
    const view = readNmapsLocation()
    if (!view) return

    const panel = getLeftPanelSize()
    const { clientX, clientY } = event
    if (clientX < 0 || clientX > panel.width || clientY < 0 || clientY > panel.height) {
      this.hideRightCursorMarker()
      return
    }

    const cursor = mouseToLatLng(clientX, clientY, view, panel)
    this.updateRightCursorFromGeo(cursor, nakarteLocation)
  }

  public handleNmapsMouseLeave(): void {
    this.hideRightCursorMarker()
  }
}
