export class ProcessingError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'ProcessingError'
  }
}

export const isProcessingError = (error: unknown): error is ProcessingError =>
  error instanceof ProcessingError ||
  (typeof error === 'object' &&
    error !== null &&
    (error as ProcessingError).name === 'ProcessingError' &&
    typeof (error as ProcessingError).code === 'string')

/** Извлекает текст ошибки для отображения пользователю. */
export const getErrorMessage = (error: unknown, fallback: string): string => {
  if (isProcessingError(error)) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export const ERR_NETWORK = 'ERR_NETWORK'
export const ERR_SHAPEFILE = 'ERR_SHAPEFILE'
