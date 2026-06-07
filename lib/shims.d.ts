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
  import type { Feature, FeatureCollection } from 'geojson'
  import type { Topology } from 'topojson-specification'

  type TopoJsonObject = Topology['objects'][string]

  export function feature(topology: Topology, object: TopoJsonObject): Feature | FeatureCollection
}
