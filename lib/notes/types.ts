export type GeomType = 'Point' | 'LineString' | 'Polygon'

export type NotePoint = {
  id?: string
  localId?: string
  name: string
  latitude: number
  longitude: number
  date: string
  noteTime?: string
  noteDesc?: string
  geomType: GeomType
  geomCoords?: [number, number][]
}
