import { describe, expect, it } from 'vitest'
import type { NotesManifest } from '@/lib/notes/model/manifest'
import type { GeometryShard } from '@/lib/notes/model/shards'
import { collectPolygonTargets, snapshotToLayerInput } from '@/lib/notes_layer/convert'
import type { NotesLayerInput } from '@/lib/notes_layer/protocol'
import { sampleGroup, sampleNote } from '@/tests/unit/notes_panel/list_props'

const manifest = (notes: NotesManifest['notes']): NotesManifest => ({
  version: 1,
  updatedAt: '2026-11-14T10:00:00.000Z',
  groups: [sampleGroup()],
  notes,
})

const shard = (notes: GeometryShard['notes']): GeometryShard => ({
  version: 1,
  updatedAt: '2026-11-14T10:00:00.000Z',
  notes,
})

const square: [number, number][] = [
  [37, 55],
  [37.1, 55],
  [37.1, 55.1],
  [37, 55.1],
]

describe('snapshotToLayerInput', () => {
  it('собирает геометрию из всех шардов в один словарь', () => {
    const input = snapshotToLayerInput({
      manifest: manifest([sampleNote({ id: 'a' }), sampleNote({ id: 'b' })]),
      shards: {
        '2026-10': shard({ a: { kind: 'Point', coords: [37, 55] } }),
        '2026-11': shard({ b: { kind: 'Line', coords: square.slice(0, 2) } }),
      },
      hiddenIds: ['b'],
    })

    expect(Object.keys(input.geometries).sort()).toEqual(['a', 'b'])
    expect(input.hiddenIds).toEqual(['b'])
    expect(input.groups.map((group) => group.id)).toEqual(['group-1'])
    expect(input.iconUrls).toEqual({})
  })

  it('пустые шарды дают снимок без геометрии', () => {
    const input = snapshotToLayerInput({
      manifest: manifest([sampleNote({ id: 'a' })]),
      shards: {},
      hiddenIds: [],
    })

    expect(input.geometries).toEqual({})
    expect(input.notes).toHaveLength(1)
  })
})

describe('collectPolygonTargets', () => {
  const input = (hiddenIds: string[]): NotesLayerInput => ({
    notes: [sampleNote({ id: 'poly', kind: 'Polygon' }), sampleNote({ id: 'point' })],
    geometries: {
      poly: { kind: 'Polygon', coords: square },
      point: { kind: 'Point', coords: [37, 55] },
    },
    groups: [],
    hiddenIds,
    iconUrls: {},
  })

  it('отдаёт только площадные фигуры', () => {
    expect(collectPolygonTargets(input([])).map((target) => target.id)).toEqual(['poly'])
  })

  it('скрытые объекты не становятся целью трассировки', () => {
    expect(collectPolygonTargets(input(['poly']))).toEqual([])
  })

  it('заметка без геометрии пропускается', () => {
    const withoutGeometry: NotesLayerInput = {
      ...input([]),
      notes: [...input([]).notes, sampleNote({ id: 'lost', kind: 'Polygon' })],
    }

    expect(collectPolygonTargets(withoutGeometry).map((target) => target.id)).toEqual(['poly'])
  })
})
