export type NmapPoint = {
  coords: [number, number]
  desc: string
}

export type NmapIndex = {
  paths: Record<string, number[][]>
  points: Record<string, NmapPoint>
}

export type ProcessResult = NmapIndex & {
  metadata: string[]
}

export const createNmapOutputTemplate = (): NmapIndex => ({
  paths: {},
  points: {},
})

const isValidIndex = (data: unknown): data is NmapIndex => {
  if (!data || typeof data !== 'object') return false
  const record = data as Record<string, unknown>
  return (
    typeof record.paths === 'object' &&
    record.paths !== null &&
    typeof record.points === 'object' &&
    record.points !== null
  )
}

/** Объединяет текущий index.json с новыми данными. */
export const mergeNmapOutputTemplate = (currentIndex: NmapIndex, newData: NmapIndex): NmapIndex => {
  if (!isValidIndex(currentIndex)) {
    return isValidIndex(newData) ? newData : createNmapOutputTemplate()
  }
  if (!isValidIndex(newData)) {
    return currentIndex
  }

  return {
    paths: { ...currentIndex.paths, ...newData.paths },
    points: { ...currentIndex.points, ...newData.points },
  }
}
