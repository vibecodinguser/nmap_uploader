import type { PolygonSnapTarget } from '@/lib/nmaps_draw_objects'
import { findTargetSnap } from './geometry'
import type {
  Capability,
  Coordinate,
  GeometryFactory,
  GeometryFactoryConstructor,
  NativeCandidate,
  NativeTracingMap,
  TracingTarget,
} from './types'

export const buildTracingTargets = (
  pendingTargets: PolygonSnapTarget[],
  geometryFactoryConstructor: GeometryFactoryConstructor | null,
  capability: Capability,
  onFailure: () => void,
): TracingTarget[] => {
  const targets: TracingTarget[] = []
  if (!geometryFactoryConstructor || capability === 'disabled') {
    return targets
  }

  let geometryFactory: GeometryFactory
  try {
    geometryFactory = new geometryFactoryConstructor()
  } catch {
    onFailure()
    return []
  }

  for (const nextTarget of pendingTargets) {
    try {
      const payload = {
        id: nextTarget.id,
        coordinates: nextTarget.coordinates.map(
          ([longitude, latitude]) => [longitude, latitude] as Coordinate,
        ),
      }
      const geometry = geometryFactory.createPolygon([payload.coordinates])
      if (
        !geometry ||
        geometry.getType() !== 'Polygon' ||
        !geometry.isTypeOf('Polygon') ||
        !Array.isArray(geometry.getCoordinates())
      ) {
        continue
      }
      const id = `nmap-uploader:note:${payload.id}`
      const candidate: NativeCandidate = Object.freeze({
        getId: () => id,
        getGeometry: () => geometry,
      })
      targets.push({ payload, geometry, candidate })
    } catch {}
  }

  return targets
}

export const findNearestTracingTarget = (
  coordinates: Coordinate,
  targets: TracingTarget[],
  map: NativeTracingMap,
  hotspotWidth: number,
): TracingTarget | null => {
  let nearest: { target: TracingTarget; distance: number } | null = null

  try {
    for (const tracingTarget of targets) {
      const snap = findTargetSnap(coordinates, tracingTarget.payload.coordinates, map, hotspotWidth)
      if (snap && (!nearest || snap.distance < nearest.distance)) {
        nearest = { target: tracingTarget, distance: snap.distance }
      }
    }
  } catch {
    return null
  }

  return nearest?.target ?? null
}

export const mergeCandidateIfMissing = (
  nativeCandidates: NativeCandidate[],
  nearestTarget: TracingTarget | null,
): NativeCandidate[] => {
  if (
    !nearestTarget ||
    nativeCandidates.some((item) => item.getId() === nearestTarget.candidate.getId())
  ) {
    return nativeCandidates
  }

  return [...nativeCandidates, nearestTarget.candidate]
}
