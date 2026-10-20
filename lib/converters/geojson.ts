import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { extractFeatureName } from '@/lib/geo_converters'
import { addFeatureToOutput, extractPaths } from '@/lib/geometry'
import type { ProcessResult } from '@/lib/nmap_index'
import { createNmapOutputTemplate } from '@/lib/nmap_index'

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
  if (geom) {
    const paths = extractPaths(geom)
    if (paths.length > 0) {
      if (featureName !== undefined) {
        if (!metadata.includes(featureName)) {
          metadata.push(featureName)
        }
      }

      let descriptionForFeature = description
      if (featureName !== undefined) {
        descriptionForFeature = featureName
      }

      addFeatureToOutput({
        output,
        geom,
        featurePaths: paths,
        description: descriptionForFeature,
      })
    }
  }
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
  const featureName = extractFeatureName(feature)
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
  } else {
    for (const feature of data.features) {
      processFeature({ feature, fileDesc, metadata: output.metadata, output })
    }
  }

  return output
}
