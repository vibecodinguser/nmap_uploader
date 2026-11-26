/**
 * Публичный ключ CRX для стабильного id расширения в dev-сборке Chrome.
 *
 * `pnpm dev:chrome` подставляет ключ в манифест, и Chrome выводит id как
 * SHA-256 от ключа: pfmakliblbchbbjplplmkdhgbofmamdm. От этого id зависит
 * redirect URI OAuth (https://<id>.chromiumapp.org/), зарегистрированный в
 * oauth.yandex.ru: со случайным id вход не работает.
 *
 * Это не секрет: ключ публичен, из него получается только id расширения.
 * В релизную сборку не попадает — Chrome Web Store выдаёт свой id сам.
 * Проверка соответствия ключа и id — tests/unit/manifest/chrome_dev_key.test.ts.
 */
export const CHROME_DEV_EXTENSION_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAjY+I2j0AnyD3H7hVx46GuJ9ycMfZgRwKZbLdNOCsAAY1nV8a0Tj67u/1PpRw3z0gSEilBsaitBcdFR8dFju1WqxxNx685Q8AQ3GNzvYIy6oS8mSFNKAQ5LywsvhSuZ5AUJbYcOGQu+BVyhbcVK7Q/JYDbUW6idPzhQdcIWG/FG4iLSmnzGPdtUYihU/3wP8qDRXsHda58KoBeQ3atnN2Hc+1ZzVt8cyplQNIWE6mPxwsqAoheIBG3MZRxwU5Lsgpqw1IezuKHKjepjs20pXvsqgX3JtiHZmSZNBuqrftiPaNcbgW6Myc8kl3UZmiHYfVbHrfgqfWSVaTnmMdTvwOdQIDAQAB'

/**
 * Поле `key` манифеста для dev-сборки Chrome.
 *
 * Ключ нужен только `wxt serve` в Chrome: там он закрепляет id расширения.
 * В релизной сборке его быть не должно — id выдаёт Chrome Web Store, а лишний
 * `key` в манифесте мешает публикации.
 */
export const chromeDevManifestKey = (
  browser: string,
  command: string,
): { key: string } | Record<string, never> =>
  browser === 'chrome' && command === 'serve' ? { key: CHROME_DEV_EXTENSION_KEY } : {}
