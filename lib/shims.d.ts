declare module 'shpjs' {
  import type { FeatureCollection } from 'geojson'

  function shp(input: ArrayBuffer | string): Promise<FeatureCollection | FeatureCollection[]>
  export default shp
}

declare module '*.svg' {
  const src: string
  export default src
}

declare module 'topojson-client' {
  import type { FeatureCollection, GeometryObject } from 'geojson'
  import type { Topology } from 'topojson-specification'

  export function feature(topology: Topology, object: GeometryObject): FeatureCollection
}
