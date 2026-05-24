import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { addFeatureToOutput, extractPaths } from '@/lib/geometry'
import type { ProcessResult } from '@/lib/nmap_index'
import { createNmapOutputTemplate } from '@/lib/nmap_index'

const getFeatureName = (feature: Feature): string | undefined => {
  const props = feature.properties
  if (!props) return undefined

  for (const key of ['name', 'title', 'NAME', 'TITLE', 'Name']) {
    const value = props[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return undefined
}

const processGeometry = ({
  output,
  geom,
  description,
  metadata,
  featureName,
}: {
  output: ProcessResult
  geom: Geometry | null | undefined
  description: string
  metadata: string[]
  featureName?: string
}): void => {
  if (!geom) return

  const paths = extractPaths(geom)
  if (paths.length === 0) return

  if (featureName && !metadata.includes(featureName)) {
    metadata.push(featureName)
  }

  addFeatureToOutput({
    output,
    geom,
    featurePaths: paths,
    description: featureName ?? description,
  })
}

const processFeature = ({
  feature,
  fileDesc,
  metadata,
  output,
}: {
  feature: Feature
  fileDesc: string
  metadata: string[]
  output: ProcessResult
}): void => {
  const featureName = getFeatureName(feature)
  processGeometry({
    output,
    geom: feature.geometry,
    description: fileDesc,
    metadata,
    featureName,
  })
}

/** Конвертирует GeoJSON FeatureCollection в формат index.json. */
export const processGeoJsonData = ({
  data,
  fileDesc,
}: {
  data: FeatureCollection | Feature
  fileDesc: string
}): ProcessResult => {
  const output: ProcessResult = { ...createNmapOutputTemplate(), metadata: [] }

  if (data.type === 'Feature') {
    processFeature({ feature: data, fileDesc, metadata: output.metadata, output })
    return output
  }

  for (const feature of data.features) {
    processFeature({ feature, fileDesc, metadata: output.metadata, output })
  }

  return output
}
