import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { addFeatureToOutput, extractPaths } from '@/lib/geometry';
import type { ProcessResult } from '@/lib/nmap_index';
import { createNmapOutputTemplate } from '@/lib/nmap_index';

const FEATURE_NAME_KEYS = ['name', 'title', 'NAME', 'TITLE', 'Name'] as const;

const getTrimmedNonEmptyString = (value: unknown): string | undefined => {
  let result: string | undefined;

  if (typeof value === 'string') {
    if (value.trim().length > 0) {
      result = value.trim();
    }
  }

  return result;
};

const getFeatureName = (feature: Feature): string | undefined => {
  const props = feature.properties;
  let featureName: string | undefined;

  if (props) {
    for (const key of FEATURE_NAME_KEYS) {
      if (featureName === undefined) {
        const name = getTrimmedNonEmptyString(props[key]);
        if (name !== undefined) {
          featureName = name;
        }
      }
    }
  }

  return featureName;
};

const processGeometry = ({
  output,
  geom,
  description,
  metadata,
  featureName,
}: {
  output: ProcessResult;
  geom: Geometry | null | undefined;
  description: string;
  metadata: string[];
  featureName?: string;
}): void => {
  if (geom) {
    const paths = extractPaths(geom);
    if (paths.length > 0) {
      if (featureName !== undefined) {
        if (!metadata.includes(featureName)) {
          metadata.push(featureName);
        }
      }

      let descriptionForFeature = description;
      if (featureName !== undefined) {
        descriptionForFeature = featureName;
      }

      addFeatureToOutput({
        output,
        geom,
        featurePaths: paths,
        description: descriptionForFeature,
      });
    }
  }
};

const processFeature = ({
  feature,
  fileDesc,
  metadata,
  output,
}: {
  feature: Feature;
  fileDesc: string;
  metadata: string[];
  output: ProcessResult;
}): void => {
  const featureName = getFeatureName(feature);
  processGeometry({
    output,
    geom: feature.geometry,
    description: fileDesc,
    metadata,
    featureName,
  });
};

/** Конвертирует GeoJSON FeatureCollection в формат index.json. */
export const processGeoJsonData = ({
  data,
  fileDesc,
}: {
  data: FeatureCollection | Feature;
  fileDesc: string;
}): ProcessResult => {
  const output: ProcessResult = { ...createNmapOutputTemplate(), metadata: [] };

  if (data.type === 'Feature') {
    processFeature({ feature: data, fileDesc, metadata: output.metadata, output });
  } else {
    for (const feature of data.features) {
      processFeature({ feature, fileDesc, metadata: output.metadata, output });
    }
  }

  return output;
};
