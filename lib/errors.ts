export class ProcessingError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'ProcessingError'
  }
}

export const ERR_NETWORK = 'ERR_NETWORK'
export const ERR_SHAPEFILE = 'ERR_SHAPEFILE'
