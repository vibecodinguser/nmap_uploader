import type { DrawMapObjectsDetail } from '@/lib/nmaps_draw_objects'
import { findActiveMap, type YmapsMapLike } from './map_discovery'

export class NmapsObjectDrawer {
  private customCollection: any = null

  public drawObjects(
    detail: DrawMapObjectsDetail,
    activeMapGetter: () => YmapsMapLike | null = findActiveMap,
  ): void {
    const { points } = detail
    const ymaps = (globalThis as unknown as Record<string, any>).ymaps
    if (!ymaps) return

    const map = activeMapGetter()
    if (!map) return

    const unsavedPoints = points.filter((p) => !p.id)
    if (unsavedPoints.length === 0) {
      this.clear()
      return
    }

    if (!this.customCollection) {
      this.customCollection = new ymaps.GeoObjectCollection(
        {},
        {
          strokeColor: '#0078FF',
          strokeWidth: 3,
          fillColor: 'rgba(0, 120, 255, 0.25)',
          interactivityModel: 'default#transparent',
        },
      )
      ;(map as Record<string, any>).geoObjects.add(this.customCollection)
    }

    this.customCollection.removeAll()

    unsavedPoints.forEach((p: any) => {
      if (p.geomType === 'Polygon' && p.geomCoords) {
        const polygon = new ymaps.Polygon(
          [p.geomCoords],
          { hintContent: p.name || p.noteDesc },
          { fill: true, interactivityModel: 'default#transparent' },
        )
        this.customCollection.add(polygon)
      } else if (p.geomType === 'LineString' && p.geomCoords) {
        const polyline = new ymaps.Polyline(
          p.geomCoords,
          { hintContent: p.name || p.noteDesc },
          { interactivityModel: 'default#transparent' },
        )
        this.customCollection.add(polyline)
      } else {
        const placemark = new ymaps.Placemark(
          [p.longitude, p.latitude],
          { hintContent: p.name || p.noteDesc },
          { interactivityModel: 'default#transparent' },
        )
        this.customCollection.add(placemark)
      }
    })
  }

  public clear(): void {
    if (this.customCollection) {
      this.customCollection.removeAll()
    }
  }
}
