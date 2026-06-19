import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'vitest';
import {
  clearAuth,
  ensureYandexAuth,
  fetchYandexAvatarDataUrl,
  getStoredAuth,
  launchYandexAuth,
  saveAuth,
} from '@/lib/yandex/client';
import {
  buildOAuthRedirectUrl,
  launchWebAuthFlow,
  type OAuthRedirectUrlOptions,
} from '@/tests/setup/browser_mock';

function assertCalledOnce(mock: { mock: { calls: unknown[] } }): void {
  assert.equal(mock.mock.calls.length, 1);
}

function assertNotCalled(mock: { mock: { calls: unknown[] } }): void {
  assert.equal(mock.mock.calls.length, 0);
}

function assertStringContains(value: string, substring: string): void {
  const contains = value.includes(substring);
  assert.ok(contains);
}

function getLaunchWebAuthFlowCallUrl(): string {
  const call = launchWebAuthFlow.mock.calls[0] as unknown as [{ url?: string }];
  assert.ok(call !== undefined);
  const url = call[0]?.url;
  assert.ok(url !== undefined);
  return url;
}

function parseLaunchWebAuthFlowUrl(): URL {
  const callUrl = getLaunchWebAuthFlowCallUrl();
  return new URL(callUrl);
}

function mockOAuthRedirectUrl(options: OAuthRedirectUrlOptions = {}): void {
  const redirectUrl = buildOAuthRedirectUrl(options);
  launchWebAuthFlow.mockResolvedValueOnce(redirectUrl);
}

async function resetAuth(): Promise<void> {
  await clearAuth();
}

async function authHappyPath(): Promise<void> {
  const auth = await launchYandexAuth({ interactive: true });

  assert.equal(auth.token, 'test-token');
  assert.equal(auth.user.login, 'testuser');
  assertCalledOnce(launchWebAuthFlow);

  const authUrl = parseLaunchWebAuthFlowUrl();
  assert.equal(authUrl.origin, 'https://oauth.yandex.ru');

  const responseType = authUrl.searchParams.get('response_type');
  assert.equal(responseType, 'token');

  const redirectUri = authUrl.searchParams.get('redirect_uri');
  assert.equal(redirectUri, 'https://extension-id.chromiumapp.org/');

  const scope = authUrl.searchParams.get('scope') ?? '';
  assertStringContains(scope, 'cloud_api:disk.write');
}

async function avatarPortrait(): Promise<void> {
  const dataUrl = await fetchYandexAvatarDataUrl({ avatarId: '131652443' });
  assert.ok(dataUrl !== null);
  assert.match(dataUrl, /^data:image\/png;base64,/);
}

async function noSilentAfterLogout(): Promise<void> {
  await saveAuth({
    token: 'stored-token',
    user: { id: '1', login: 'cached' },
  });
  await clearAuth({ explicit: true });

  const auth = await ensureYandexAuth({ interactive: false });

  assert.equal(auth, null);
  assertNotCalled(launchWebAuthFlow);
}

async function cachedSession(): Promise<void> {
  await saveAuth({
    token: 'stored-token',
    user: { id: '1', login: 'cached' },
  });

  const auth = await ensureYandexAuth({ interactive: false });

  assert.ok(auth !== null);
  assert.equal(auth.token, 'stored-token');
  assert.equal(auth.user.login, 'testuser');
  assert.equal(auth.user.default_avatar_id, '131652443');
  assertNotCalled(launchWebAuthFlow);
}

async function refreshExpiredToken(): Promise<void> {
  await saveAuth({
    token: 'expired-token',
    user: { id: '1', login: 'old' },
  });

  const auth = await ensureYandexAuth({ interactive: false });

  assert.ok(auth !== null);
  assert.equal(auth.token, 'test-token');
  assertCalledOnce(launchWebAuthFlow);

  const storedAuth = await getStoredAuth();
  assert.ok(storedAuth !== null);
  assert.equal(storedAuth.token, 'test-token');
}

async function silentUnavailable(): Promise<void> {
  const accessError = new Error('did not approve access');
  launchWebAuthFlow.mockRejectedValueOnce(accessError);

  const auth = await ensureYandexAuth({ interactive: false });

  assert.equal(auth, null);
}

async function interactivePassport(): Promise<void> {
  mockOAuthRedirectUrl();

  const auth = await ensureYandexAuth({ interactive: true });

  assert.ok(auth !== null);
  assert.equal(auth.token, 'test-token');
  assertCalledOnce(launchWebAuthFlow);

  const launchUrl = parseLaunchWebAuthFlowUrl();
  assert.equal(launchUrl.origin, 'https://passport.yandex.ru');
  assert.equal(launchUrl.pathname, '/auth/list');

  const retpath = launchUrl.searchParams.get('retpath') ?? '';
  assertStringContains(retpath, 'https://oauth.yandex.ru/authorize');
  assertStringContains(retpath, 'force_confirm=yes');
}

async function interactiveAfterLogout(): Promise<void> {
  await clearAuth({ explicit: true });

  const auth = await ensureYandexAuth({ interactive: true });

  assert.ok(auth !== null);
  assert.equal(auth.token, 'test-token');
  assertCalledOnce(launchWebAuthFlow);

  const launchUrl = parseLaunchWebAuthFlowUrl();
  assert.equal(launchUrl.origin, 'https://passport.yandex.ru');
}

async function invokeLaunchAuth(): Promise<void> {
  await launchYandexAuth();
}

async function invokeLaunchAuthInteractive(): Promise<void> {
  await launchYandexAuth({ interactive: true });
}

async function oauthHashError(): Promise<void> {
  mockOAuthRedirectUrl({ error: 'access_denied', errorDescription: 'User denied' });

  await assert.rejects(invokeLaunchAuth, { message: /OAuth/ });
}

async function rejectMissingScope(): Promise<void> {
  mockOAuthRedirectUrl({ scope: 'login:avatar' });

  await assert.rejects(invokeLaunchAuth, { message: /disk\.write/ });
}

async function authCancelled(): Promise<void> {
  launchWebAuthFlow.mockResolvedValueOnce(undefined as unknown as string);

  await assert.rejects(invokeLaunchAuthInteractive, { message: 'Авторизация отменена' });
}

function oauthTests(): void {
  beforeEach(resetAuth);

  it('launchYandexAuth: парсит токен, проверяет scope и возвращает пользователя', authHappyPath);
  it('fetchYandexAvatarDataUrl: возвращает data URL портрета', avatarPortrait);
  it('ensureYandexAuth: после явного выхода не выполняет silent OAuth', noSilentAfterLogout);
  it('ensureYandexAuth: возвращает сохранённую сессию без launchWebAuthFlow', cachedSession);
  it('ensureYandexAuth: при просроченном токене запускает silent OAuth', refreshExpiredToken);
  it(
    'ensureYandexAuth: без interactive возвращает null, если silent OAuth недоступен',
    silentUnavailable,
  );
  it(
    'ensureYandexAuth: с interactive открывает выбор аккаунта через Passport',
    interactivePassport,
  );
  it(
    'ensureYandexAuth: после явного выхода interactive не выполняет silent OAuth',
    interactiveAfterLogout,
  );
  it('launchYandexAuth: пробрасывает OAuth-ошибку из hash', oauthHashError);
  it('launchYandexAuth: отклоняет токен без cloud_api:disk.write', rejectMissingScope);
  it('launchYandexAuth: обрабатывает отмену пользователем', authCancelled);
}

describe('OAuth', oauthTests);
