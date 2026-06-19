export class ProcessingError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'ProcessingError';
  }
}

export const isProcessingError = (error: unknown): error is ProcessingError => {
  let result = false;

  if (error instanceof ProcessingError) {
    result = true;
  } else if (null !== error && 'object' === typeof error) {
    const potentialError = error as Record<string, unknown>;

    const hasName = 'name' in potentialError && 'string' === typeof potentialError.name;
    const isProcessingErrorName = hasName && 'ProcessingError' === potentialError.name;

    const hasCode = 'code' in potentialError && 'string' === typeof potentialError.code;
    const hasMessage = 'message' in potentialError && 'string' === typeof potentialError.message;

    result = isProcessingErrorName && hasCode && hasMessage;
  }

  return result;
};

/** Извлекает текст ошибки для отображения пользователю. */
export const getErrorMessage = (error: unknown, fallback: string): string => {
  let errorMessage = fallback;
  if (isProcessingError(error)) {
    errorMessage = error.message;
  } else if (error instanceof Error && error.message) {
    errorMessage = error.message;
  }
  return errorMessage;
};

export const ERR_NETWORK = 'ERR_NETWORK';
export const ERR_SHAPEFILE = 'ERR_SHAPEFILE';
