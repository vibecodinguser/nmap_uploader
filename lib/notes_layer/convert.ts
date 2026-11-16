import type { NotesManifest } from '@/lib/notes/model/manifest'
import type { GeometryShard } from '@/lib/notes/model/shards'
import type { NoteGeometry } from '@/lib/notes/model/types'
import type { PolygonSnapTarget } from '@/lib/tracing/types'
import { polygonRing } from './objects'
import type { NotesLayerInput } from './protocol'

/**
 * Перевод снимка хранилища в то, что нужно слою карты.
 *
 * Слой не знает ни про манифест, ни про шарды: для него есть плоский набор
 * геометрий. Здесь же решается, какие полигоны годятся в цели нативной
 * трассировки.
 */

/** Раскладывает снимок хранилища в то, что нужно слою. */
export const snapshotToLayerInput = ({
  manifest,
  shards,
  hiddenIds,
  iconUrls = {},
}: {
  manifest: NotesManifest
  shards: Record<string, GeometryShard>
  hiddenIds: string[]
  iconUrls?: Record<string, string>
}): NotesLayerInput => {
  const geometries: Record<string, NoteGeometry> = {}
  for (const shard of Object.values(shards)) {
    Object.assign(geometries, shard.notes)
  }

  return { notes: manifest.notes, geometries, groups: manifest.groups, hiddenIds, iconUrls }
}

/** Полигоны заметок, к которым разрешено притягивать нативную трассировку. */
export const collectPolygonTargets = (input: NotesLayerInput): PolygonSnapTarget[] => {
  const hidden = new Set(input.hiddenIds)
  const targets: PolygonSnapTarget[] = []

  for (const note of input.notes) {
    if (hidden.has(note.id)) continue
    const geometry = input.geometries[note.id]
    if (!geometry) continue

    const ring = polygonRing(geometry)
    if (ring && ring.length >= 4) {
      targets.push({ id: note.id, coordinates: ring })
    }
  }

  return targets
}
