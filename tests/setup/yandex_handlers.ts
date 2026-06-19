import { HttpResponse, http } from 'msw';

const URI_SCHEME = 'https';
const DISK_API_HOST = 'cloud-api.yandex.net/v1/disk';
const LOGIN_INFO_HOST = 'login.yandex.ru/info';
const MOCK_INDEX_DOWNLOADER_HOST = 'downloader.disk.yandex.ru/mock-index';
const MOCK_INDEX_UPLOADER_HOST = 'uploader.disk.yandex.ru/mock-index';
const AVATAR_API_HOST = 'avatars.yandex.net/get-yapic/*';

// biome-ignore lint/style/useTemplate: split '://' so analyzers do not treat '//' as a comment
const DISK_API = URI_SCHEME + '://' + DISK_API_HOST;
// biome-ignore lint/style/useTemplate: split '://' so analyzers do not treat '//' as a comment
const LOGIN_INFO = URI_SCHEME + '://' + LOGIN_INFO_HOST;
// biome-ignore lint/style/useTemplate: split '://' so analyzers do not treat '//' as a comment
const MOCK_INDEX_DOWNLOADER = URI_SCHEME + '://' + MOCK_INDEX_DOWNLOADER_HOST;
// biome-ignore lint/style/useTemplate: split '://' so analyzers do not treat '//' as a comment
const MOCK_INDEX_UPLOADER = URI_SCHEME + '://' + MOCK_INDEX_UPLOADER_HOST;
// biome-ignore lint/style/useTemplate: split '://' so analyzers do not treat '//' as a comment
const AVATAR_API = URI_SCHEME + '://' + AVATAR_API_HOST;

const OAUTH_PREFIX_PATTERN = /^OAuth\s+/i;
// biome-ignore lint/complexity/useRegexLiterals: '^disk:/' must not use // literal — confuses static analyzers
const DISK_PREFIX_PATTERN = new RegExp('^disk:/');
const LEADING_SLASHES_PATTERN = /^\/+/;
const TRAILING_SLASHES_PATTERN = /\/+$/;
const DATE_FOLDER_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const AVATAR_PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);
const DISK_APPLICATIONS_PATH = 'disk:/Приложения';

const createdPaths = new Set<string>();
const putFailureCounts = new Map<string, number>();
let indexJsonBody: Record<string, unknown> | null = null;

const getTokenFromAuth = (request: Request): string => {
  const auth = request.headers.get('Authorization') ?? '';
  const withoutOAuthPrefix = auth.replace(OAUTH_PREFIX_PATTERN, '');
  return withoutOAuthPrefix.trim();
};

const isExpiredToken = (token: string): boolean => token === 'expired-token';

function getRequestSearchParam(request: Request, paramName: string): string | null {
  const requestUrl = new URL(request.url);
  const searchParams = requestUrl.searchParams;
  return searchParams.get(paramName);
}

function buildListPrefix(normalizedParent: string): string {
  let prefix = `${normalizedParent}/`;
  if (normalizedParent === '/') {
    prefix = '/';
  }
  return prefix;
}

/** Приводит path из API к единому виду (`/Приложения/...`). */
export function normalizeDiskPath(path: string): string {
  const withoutDiskPrefix = path.replace(DISK_PREFIX_PATTERN, '');
  const logical = withoutDiskPrefix.replace(LEADING_SLASHES_PATTERN, '');
  let normalized = '/';
  if (logical) {
    normalized = `/${logical}`;
  }
  return normalized;
}

/** Сбрасывает in-memory состояние моков Яндекс API между тестами. */
export const resetYandexMockState = () => {
  createdPaths.clear();
  putFailureCounts.clear();
  indexJsonBody = null;
};

/** Возвращает нормализованные пути папок, созданных через PUT. */
export const getCreatedPaths = (): string[] => {
  const paths = [...createdPaths];
  return paths.sort();
};

/**
 * Симулирует ответ 409 DiskPathDoesntExistsError для следующих N попыток PUT.
 * Используется в тестах создания вложенных папок.
 */
export const simulateParentNotFoundOnPut = (path: string, attempts = 1): void => {
  const normalizedPath = normalizeDiskPath(path);
  putFailureCounts.set(normalizedPath, attempts);
};

const isDirectoryCreated = (path: string): boolean => {
  const normalizedPath = normalizeDiskPath(path);
  return createdPaths.has(normalizedPath);
};

function isDateChildFolder(candidate: string, prefix: string, normalizedParent: string): boolean {
  let isMatch = false;
  if (candidate.startsWith(prefix) && candidate !== normalizedParent) {
    const relative = candidate.slice(prefix.length);
    const containsSlash = relative.includes('/');
    if (containsSlash) {
      isMatch = false;
    } else {
      isMatch = DATE_FOLDER_PATTERN.test(relative);
    }
  }
  return isMatch;
}

function lastPathSegment(path: string): string {
  const segments = path.split('/');
  const lastSegment = segments.pop();
  return lastSegment ?? '';
}

function listDateChildFolders(parentPath: string): string[] {
  const parentNormalized = normalizeDiskPath(parentPath);
  const withoutTrailingSlash = parentNormalized.replace(TRAILING_SLASHES_PATTERN, '');
  const normalizedParent = withoutTrailingSlash || '/';
  const prefix = buildListPrefix(normalizedParent);

  const folderNames: string[] = [];
  const rawPaths = [...createdPaths];
  for (const rawPath of rawPaths) {
    const normalizedCandidate = normalizeDiskPath(rawPath);
    const isCandidate = isDateChildFolder(normalizedCandidate, prefix, normalizedParent);
    if (isCandidate) {
      const folderName = lastPathSegment(normalizedCandidate);
      if (folderName) {
        folderNames.push(folderName);
      }
    }
  }

  return folderNames.sort();
}

function markDirectoryCreated(path: string): void {
  const normalizedPath = normalizeDiskPath(path);
  createdPaths.add(normalizedPath);
}

function buildDirListItem(name: string, pathWithoutTrailingSlash: string) {
  return {
    type: 'dir',
    name,
    path: `${pathWithoutTrailingSlash}/${name}`,
  };
}

function buildDiskResourcesListResponse(
  request: Request,
  path: string,
  normalizedPath: string,
  limitParam: string,
): Response {
  let response: Response;
  const dateFolders = listDateChildFolders(normalizedPath);
  const listingAvailable = dateFolders.length > 0 || isDirectoryCreated(path);

  if (listingAvailable) {
    const offsetParam = getRequestSearchParam(request, 'offset');
    const offset = Number(offsetParam ?? 0);
    const limit = Number(limitParam);
    const pathWithoutTrailingSlash = normalizedPath.replace(TRAILING_SLASHES_PATTERN, '');
    const pageSlice = dateFolders.slice(offset, offset + limit);
    const page = [];
    for (const name of pageSlice) {
      const listItem = buildDirListItem(name, pathWithoutTrailingSlash);
      page.push(listItem);
    }
    response = HttpResponse.json({
      type: 'dir',
      _embedded: {
        items: page,
        limit,
        offset,
        total: dateFolders.length,
      },
    });
  } else {
    response = new HttpResponse(null, { status: 404 });
  }

  return response;
}

function buildResourceMetaResponse(path: string, normalizedPath: string): Response {
  let response: Response;
  const isIndexJson = normalizedPath.endsWith('/index.json') && indexJsonBody;

  if (isIndexJson) {
    response = HttpResponse.json({ type: 'file', name: 'index.json', path: normalizedPath });
  } else if (isDirectoryCreated(path)) {
    const directoryName = lastPathSegment(normalizedPath);
    response = HttpResponse.json({
      type: 'dir',
      name: directoryName,
      path: normalizedPath,
    });
  } else {
    response = new HttpResponse(null, { status: 404 });
  }

  return response;
}

function buildDiskResourcesGetResponse(
  request: Request,
  path: string,
  normalizedPath: string,
): Response {
  let response: Response;
  const limitParam = getRequestSearchParam(request, 'limit');
  if (limitParam) {
    response = buildDiskResourcesListResponse(request, path, normalizedPath, limitParam);
  } else {
    response = buildResourceMetaResponse(path, normalizedPath);
  }
  return response;
}

function handleDiskRootGet({ request }: { request: Request }) {
  let response: Response;
  const token = getTokenFromAuth(request);

  if (isExpiredToken(token)) {
    response = new HttpResponse(null, { status: 401 });
  } else {
    const fields = getRequestSearchParam(request, 'fields');
    if (fields?.includes('system_folders')) {
      response = HttpResponse.json({
        system_folders: { applications: DISK_APPLICATIONS_PATH },
      });
    } else {
      response = HttpResponse.json({ total_space: 10_000_000_000 });
    }
  }

  return response;
}

function handleLoginInfoGet({ request }: { request: Request }) {
  let response: Response;
  const token = getTokenFromAuth(request);

  if (isExpiredToken(token)) {
    response = new HttpResponse(null, { status: 401 });
  } else {
    response = HttpResponse.json({
      id: '123',
      login: 'testuser',
      display_name: 'Test User',
      default_avatar_id: '131652443',
    });
  }

  return response;
}

function handleDiskResourcesGet({ request }: { request: Request }) {
  let response: Response;
  const token = getTokenFromAuth(request);

  if (isExpiredToken(token)) {
    response = new HttpResponse(null, { status: 401 });
  } else {
    const path = getRequestSearchParam(request, 'path');
    if (path) {
      const normalizedPath = normalizeDiskPath(path);
      response = buildDiskResourcesGetResponse(request, path, normalizedPath);
    } else {
      response = new HttpResponse(null, { status: 400 });
    }
  }

  return response;
}

function handleDiskResourcesPut({ request }: { request: Request }) {
  let response: Response;
  const token = getTokenFromAuth(request);

  if (isExpiredToken(token)) {
    response = new HttpResponse(null, { status: 401 });
  } else {
    const path = getRequestSearchParam(request, 'path');
    if (path) {
      const normalizedPath = normalizeDiskPath(path);
      const failuresLeft = putFailureCounts.get(normalizedPath) ?? 0;
      if (failuresLeft > 0) {
        putFailureCounts.set(normalizedPath, failuresLeft - 1);
        response = HttpResponse.json(
          {
            error: 'DiskPathDoesntExistsError',
            description: `Specified path "${path}" doesn't exists.`,
            message: `Указанного пути "${path}" не существует.`,
          },
          { status: 409 },
        );
      } else {
        markDirectoryCreated(path);
        response = new HttpResponse(null, { status: 201 });
      }
    } else {
      response = new HttpResponse(null, { status: 400 });
    }
  }

  return response;
}

function handleDiskResourcesDownloadGet({ request }: { request: Request }) {
  let response: Response = new HttpResponse(null, { status: 404 });
  const path = getRequestSearchParam(request, 'path');

  if (path) {
    const normalizedDownloadPath = normalizeDiskPath(path);
    if (normalizedDownloadPath.endsWith('/index.json') && indexJsonBody) {
      response = HttpResponse.json({ href: MOCK_INDEX_DOWNLOADER });
    }
  }

  return response;
}

function handleMockIndexDownloadGet() {
  let response: Response;

  if (indexJsonBody) {
    response = HttpResponse.json(indexJsonBody);
  } else {
    response = new HttpResponse(null, { status: 404 });
  }

  return response;
}

function handleDiskResourcesUploadGet({ request }: { request: Request }) {
  let response: Response;
  const token = getTokenFromAuth(request);

  if (isExpiredToken(token)) {
    response = new HttpResponse(null, { status: 401 });
  } else {
    const path = getRequestSearchParam(request, 'path');
    if (path) {
      const normalizedUploadPath = normalizeDiskPath(path);
      if (normalizedUploadPath.endsWith('/index.json')) {
        response = HttpResponse.json({ href: MOCK_INDEX_UPLOADER });
      } else {
        response = new HttpResponse(null, { status: 400 });
      }
    } else {
      response = new HttpResponse(null, { status: 400 });
    }
  }

  return response;
}

async function handleMockIndexUploadPut({ request }: { request: Request }) {
  indexJsonBody = (await request.json()) as Record<string, unknown>;
  return new HttpResponse(null, { status: 201 });
}

function handleAvatarGet() {
  return new HttpResponse(AVATAR_PNG, {
    headers: { 'Content-Type': 'image/png' },
  });
}

export const yandexHandlers = [
  http.get(`${DISK_API}/`, handleDiskRootGet),
  http.get(LOGIN_INFO, handleLoginInfoGet),
  http.get(`${DISK_API}/resources`, handleDiskResourcesGet),
  http.put(`${DISK_API}/resources`, handleDiskResourcesPut),
  http.get(`${DISK_API}/resources/download`, handleDiskResourcesDownloadGet),
  http.get(MOCK_INDEX_DOWNLOADER, handleMockIndexDownloadGet),
  http.get(`${DISK_API}/resources/upload`, handleDiskResourcesUploadGet),
  http.put(MOCK_INDEX_UPLOADER, handleMockIndexUploadPut),
  http.get(AVATAR_API, handleAvatarGet),
];

/** Предзаполняет index.json на «Диске» для сценариев с существующим файлом. */
export const seedIndexJson = (data: Record<string, unknown>) => {
  indexJsonBody = data;
};
