const DISK_ROOT_PREFIX = '/'
const DISK_SCHEME_PREFIX = 'disk:/'
export const APPLICATIONS_FOLDER = 'Приложения'

export const toDiskApiPath = (logicalPath: string): string => {
  if (!logicalPath) {
    return DISK_ROOT_PREFIX
  }
  if (logicalPath.startsWith('disk:/') || logicalPath.startsWith('app:/')) {
    return logicalPath
  }
  const noLeadingSlash = logicalPath.replace(/^\/+/, '')
  const normalized = noLeadingSlash.replace(/\/+$/, '')
  return `${DISK_ROOT_PREFIX}${normalized}`
}

export const fromDiskApiPath = (path: string): string => {
  const noDiskPrefix = path.replace(/^disk:\//, '')
  return noDiskPrefix.replace(/^\/+/, '')
}

export const getDiskApiPathVariants = (logicalPath: string): string[] => {
  const fromDiskPath = fromDiskApiPath(logicalPath)
  const normalized = fromDiskPath.replace(/\/+$/, '')
  if (!normalized) {
    const schemePrefix = DISK_SCHEME_PREFIX.slice(0, -1)
    return [DISK_ROOT_PREFIX, schemePrefix]
  }

  const slashPath = `${DISK_ROOT_PREFIX}${normalized}`
  const schemePath = `${DISK_SCHEME_PREFIX}${normalized}`
  if (slashPath === schemePath) {
    return [slashPath]
  }
  return [slashPath, schemePath]
}

export const getParentLogicalPath = (logicalPath: string): string => {
  const fromDiskPath = fromDiskApiPath(logicalPath)
  const normalized = fromDiskPath.replace(/\/+$/, '')
  const lastSlash = normalized.lastIndexOf('/')
  if (lastSlash === -1) {
    return ''
  }
  return normalized.slice(0, lastSlash)
}

export const isApplicationsFolder = (logicalPath: string): boolean => {
  const diskPath = fromDiskApiPath(logicalPath)
  return diskPath === APPLICATIONS_FOLDER
}
