/**
 * gecko.id Firefox-сборки (wxt.config.ts browser_specific_settings.gecko.id).
 *
 * Менять только вместе с `FIREFOX_OAUTH_REDIRECT_URI`: от этой строки
 * зависит redirect URI для OAuth (SHA1), а он зарегистрирован в
 * oauth.yandex.ru. При смене авторизация в Firefox перестаёт работать с
 * ошибкой «redirect_uri не совпадает с Callback URL».
 */
export const FIREFOX_EXTENSION_ID = 'nmap-uploader@local.dev'
