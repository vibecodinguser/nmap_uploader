/** Yandex Browser добавляет «YaBrowser» в userAgent. */
export const isYandexBrowser = (): boolean => navigator.userAgent.includes('YaBrowser')
